import type {HTMLTemplateResult, TemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';
import {localized, msg} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import type {ISurveyConfig, Item, ItemSummary} from './ingv-config-survey.js';
import '../../plugins/cesium/ngv-plugin-cesium-widget';
import '../../plugins/cesium/ngv-plugin-cesium-upload';
import '../../plugins/cesium/ngv-plugin-cesium-model-interact';
import '../../plugins/cesium/ngv-plugin-cesium-slicing';
import '../../plugins/cesium/ngv-plugin-cesium-measure';
import '../../plugins/cesium/ngv-plugin-cesium-navigation';
import '../../plugins/cesium/ngv-plugin-cesium-click-info';
import '../../plugins/cesium/ngv-plugin-cesium-offline';
import '../../plugins/ui/ngv-survey';
import type {
  CesiumWidget,
  DataSourceCollection,
  Entity,
  PointGraphics,
} from '@cesium/engine';
import {ScreenSpaceEventHandler, ScreenSpaceEventType} from '@cesium/engine';
import {BoundingSphere, ConstantProperty, JulianDate} from '@cesium/engine';
import {
  Cartesian3,
  Color,
  HeightReference,
  CustomDataSource,
} from '@cesium/engine';
import type {ViewerInitializedDetails} from '../../plugins/cesium/ngv-plugin-cesium-widget.js';
import type {ClickDetail} from '../../plugins/cesium/ngv-plugin-cesium-click-info.js';
import type {FieldValues} from '../../plugins/ui/ngv-survey.js';
import {
  getJson as readJsonFile,
  getOrCreateDirectoryChain,
  persistJson,
  removeFile,
} from '../../utils/storage-utils.js';
import type {Coordinate} from '../../utils/generalTypes.js';
import {Task} from '@lit/task';
import type {OfflineInfo} from '../../plugins/cesium/ngv-plugin-cesium-offline.js';
import type {NgvPluginCesiumNavigation} from '../../plugins/cesium/ngv-plugin-cesium-navigation.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import {poolRunner} from '../../utils/pool-runner.js';

const STORAGE_DIR = ['surveys'];
const STORAGE_LIST_NAME = 'surveys.json';

@customElement('ngv-app-survey')
@localized()
export class NgvAppSurvey extends ABaseApp<ISurveyConfig> {
  @state()
  private viewer: CesiumWidget;
  @state()
  private showSurvey = false;
  @state()
  private surveys: ItemSummary[] = [];
  @state()
  private offline: boolean = false;
  @query('ngv-plugin-cesium-navigation')
  private navElement: NgvPluginCesiumNavigation;
  private dataSourceCollection: DataSourceCollection;
  private dataSource: CustomDataSource = new CustomDataSource();
  private lastPoint: Entity | undefined;
  private persistentDir: FileSystemDirectoryHandle;
  private pointConfig: PointGraphics.ConstructorOptions;
  private pointHighlightConfig: PointGraphics.ConstructorOptions;
  private eventHandler: ScreenSpaceEventHandler | null = null;
  private currentView: IngvCesiumContext['views'][number] | null = null;

  private collections: ViewerInitializedDetails['primitiveCollections'];
  private surveyFieldValues:
    | Record<
        string,
        | string
        | number
        | Record<string, boolean>
        | Coordinate
        | TemplateResult<1>
      >
    | undefined = {};

  constructor() {
    super(() => import('./demoSurveyConfig.js'));
  }

  // @ts-expect-error TS6133
  private _configChange = new Task(this, {
    args: (): [ISurveyConfig] => [this.config],
    task: ([config]) => {
      const pointConf = config.app.cesiumContext.surveyOptions?.pointOptions;
      this.pointConfig = {
        color: pointConf?.color
          ? Color.fromCssColorString(pointConf?.color)
          : Color.RED,
        outlineWidth:
          typeof pointConf?.outlineWidth === 'number'
            ? pointConf.outlineWidth
            : 2,
        outlineColor: pointConf?.outlineColor
          ? Color.fromCssColorString(pointConf.outlineColor)
          : Color.BLACK,
        pixelSize: pointConf?.pixelSize || 5,
        heightReference: pointConf?.heightReference || HeightReference.NONE,
        disableDepthTestDistance:
          typeof pointConf?.disableDepthTestDistance === 'number'
            ? pointConf?.disableDepthTestDistance
            : undefined,
      };
      const pointHighlightConf =
        config.app.cesiumContext.surveyOptions?.pointHighlightOptions;
      this.pointHighlightConfig = {
        color: pointHighlightConf?.color
          ? Color.fromCssColorString(pointHighlightConf?.color)
          : Color.YELLOW,
        outlineWidth:
          typeof pointHighlightConf?.outlineWidth === 'number'
            ? pointHighlightConf.outlineWidth
            : 4,
        outlineColor: pointHighlightConf?.outlineColor
          ? Color.fromCssColorString(pointHighlightConf.outlineColor)
          : Color.BLUE,
        pixelSize: pointHighlightConf?.pixelSize || 7,
        disableDepthTestDistance:
          typeof pointHighlightConf?.disableDepthTestDistance === 'number'
            ? pointHighlightConf?.disableDepthTestDistance
            : undefined,
      };
    },
  });

  async loadSurveys(): Promise<void> {
    if (!this.persistentDir) {
      // FIXME: just wait on a promise?
      console.error('Directory not defined.');
      return;
    }
    if (!this.offline && this.config.app.survey.listItems) {
      this.surveys = await this.config.app.survey.listItems({
        id: this.currentView.id,
      });
    } else {
      this.surveys = await readJsonFile<ItemSummary[]>(
        this.persistentDir,
        STORAGE_LIST_NAME,
      );
    }
    if (!this.surveys) {
      this.surveys = [];
    }

    this.dataSource.entities.removeAll();

    this.surveys.forEach((s) => {
      const coords = s.coordinates;
      const position = Cartesian3.fromDegrees(coords[0], coords[1], coords[2]);
      this.addPoint(position, s.id);
      this.viewer.scene.requestRender();
    });
  }

  initializeViewer(details: ViewerInitializedDetails): void {
    this.viewer = details.viewer;
    this.dataSourceCollection = details.dataSourceCollection;
    this.dataSourceCollection
      .add(this.dataSource)
      .catch((e) => console.error(e));
    this.collections = details.primitiveCollections;
    this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler.setInputAction(
      (evt: ScreenSpaceEventHandler.PositionedEvent): void => {
        const pickedObject: {id: Entity | undefined} = <
          {id: Entity | undefined}
        >this.viewer.scene.pick(evt.position);
        if (
          !pickedObject?.id?.id ||
          !this.dataSource.entities.contains(pickedObject?.id)
        ) {
          return undefined;
        }
        this.editSurvey(pickedObject?.id?.id).catch((e) => console.error(e));
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );
  }

  addPoint(position: Cartesian3, id?: string): Entity {
    return this.dataSource.entities.add({
      id,
      position,
      point: this.pointConfig,
    });
  }

  addMarker(detail: ClickDetail): void {
    if (this.lastPoint) this.cancel();
    this.lastPoint = this.addPoint(detail.cartesian3);
    this.showSurvey = true;
    const idField = this.config.app.survey.fields.find((f) => f.type === 'id');
    if (idField) {
      this.surveyFieldValues[idField.id] = this.lastPoint.id;
    }
    const coordsFiled = this.config.app.survey.fields.find(
      (f) => f.type === 'coordinates',
    );
    if (coordsFiled) {
      const longitude = detail.projection
        ? detail.projected.longitude
        : detail.wgs84.longitude;
      const latitude = detail.projection
        ? detail.projected.latitude
        : detail.wgs84.latitude;
      this.surveyFieldValues[coordsFiled.id] = {
        longitude,
        latitude,
        height: Number(detail.elevation.toFixed(2)),
      };
    }
  }

  hideSurvey(): void {
    this.showSurvey = false;
    this.lastPoint = undefined;
    this.surveyFieldValues = {};
  }

  async confirm(evt: CustomEvent<FieldValues>): Promise<void> {
    const idField = this.config.app.survey.fields.find((f) => f.type === 'id');
    const id = <string>this.surveyFieldValues[idField?.id];
    const coordinatesField = this.config.app.survey.fields.find(
      (f) => f.type === 'coordinates',
    );
    const coordinates = <Coordinate>(
      this.surveyFieldValues[coordinatesField?.id]
    );
    if (!id) return;
    if (!this.surveys.find((s) => s.id === id)) {
      this.surveys.push({
        id,
        coordinates: [
          coordinates.longitude,
          coordinates.latitude,
          coordinates.height,
        ],
        lastModifiedMs: Date.now(), // FIXME timezone?
        title: 'Some hardcoded title',
      });
      await persistJson(this.persistentDir, STORAGE_LIST_NAME, this.surveys);
    }
    await persistJson(this.persistentDir, `${id}.json`, evt.detail);
    this.hideSurvey();
  }

  cancel(): void {
    if (this.lastPoint) {
      this.dataSource.entities.remove(this.lastPoint);
    }
    this.hideSurvey();
  }

  async onRemove(index: number): Promise<void> {
    const id = this.surveys[index]?.id;
    if (id) {
      await removeFile(this.persistentDir, `${id}.json`);
      this.surveys.splice(index, 1);
      await persistJson(this.persistentDir, STORAGE_LIST_NAME, this.surveys);
      this.surveys = [...this.surveys];
    }
  }

  async onEdit(index: number): Promise<void> {
    const id = this.surveys[index]?.id;
    await this.editSurvey(id);
  }

  async onViewChanged(view: IngvCesiumContext['views'][number]): Promise<void> {
    if (!view) return;
    this.currentView = view;
    this.persistentDir = await getOrCreateDirectoryChain([
      this.config.app.cesiumContext.name,
      this.currentView.id,
      ...STORAGE_DIR,
    ]);
    await this.loadSurveys();
  }

  async editSurvey(id: string): Promise<void> {
    if (!id) {
      return;
    }
    const survey = await this.getOrReadSurvey(id);
    if (survey) {
      this.surveyFieldValues = survey;
      this.showSurvey = true;
    }
  }
  async getOrReadSurvey(id: string): Promise<FieldValues> {
    let item: Item;
    if (this.offline) {
      item = await readJsonFile<Item>(this.persistentDir, `${id}.json`);
    } else {
      item = await this.config.app.survey.getItem(id, {});
    }
    const survey = this.config.app.survey.itemToFields(item);
    return survey;
  }

  highlightEntity(id: string): void {
    const ent = this.dataSource.entities.getById(id);
    if (!ent) return;
    ent.point.color = new ConstantProperty(this.pointHighlightConfig.color);
    ent.point.outlineColor = new ConstantProperty(
      this.pointHighlightConfig.outlineColor,
    );
    ent.point.pixelSize = new ConstantProperty(
      this.pointHighlightConfig.pixelSize,
    );
    ent.point.outlineWidth = new ConstantProperty(
      this.pointHighlightConfig.outlineWidth,
    );
    ent.point.disableDepthTestDistance = new ConstantProperty(
      this.pointHighlightConfig.disableDepthTestDistance,
    );
  }

  removeEntityHighlight(id: string): void {
    const ent = this.dataSource.entities.getById(id);
    if (!ent) return;
    ent.point.color = new ConstantProperty(this.pointConfig.color);
    ent.point.outlineColor = new ConstantProperty(
      this.pointConfig.outlineColor,
    );
    ent.point.pixelSize = new ConstantProperty(this.pointConfig.pixelSize);
    ent.point.outlineWidth = new ConstantProperty(
      this.pointConfig.outlineWidth,
    );
    ent.point.disableDepthTestDistance = new ConstantProperty(
      this.pointConfig.disableDepthTestDistance,
    );
  }

  async beforeSwitchDispatch(goingOffline: boolean): Promise<void> {
    if (goingOffline) {
      // refresh survey list
      await this.loadSurveys();
      // download all the survey items
      await poolRunner({
        concurrency: 7,
        tasks: this.surveys,
        runTask: async (s) => {
          const item = await this.config.app.survey.getItem(s.id, {});
          await persistJson(this.persistentDir, `${item.id}.json`, item);
          console.log('->', `${item.id}.json`, item);
          // FIXME: here we can download all the photos (or append to a list to be downloaded later)
        },
        // no signal, we could allow to cancel
      });
    } else {
      // going online
      console.log('FIXME: implement sync back to servers');
      // FIXME: throw if something went wrong to prevent actual switch
      // Here we should do fieldsToItem and merge the result with the original item (to not lose existing / unsupported values)
      // If the id is temporary UUID we should POST to create a proper id and replace it (for photos, then for defects)
    }
  }

  disconnectedCallback(): void {
    this.eventHandler.destroy();
    this.dataSourceCollection.destroy();
    super.disconnectedCallback();
  }

  render(): HTMLTemplateResult {
    const r = super.render();
    if (r && !this.config) {
      return r;
    }
    const offlineInfo: OfflineInfo = this.config.app.cesiumContext.offline
      ? {
          appName: this.config.app.cesiumContext.name,
          view: this.currentView,
          ...this.config.app.cesiumContext.offline,
        }
      : undefined;
    return html`
      <ngv-structure-app .config=${this.config}>
        <div
          slot="menu"
          style="display: flex; flex-direction: column; row-gap: 10px;"
        >
          ${this.viewer
            ? html`
                <ngv-plugin-cesium-slicing
                  .viewer="${this.viewer}"
                  .tiles3dCollection="${this.collections.tiles3d}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .options="${this.config.app.cesiumContext.clippingOptions}"
                ></ngv-plugin-cesium-slicing>
                <ngv-plugin-cesium-measure
                  .viewer="${this.viewer}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .options=${this.config.app.cesiumContext.measureOptions}
                ></ngv-plugin-cesium-measure>
                ${offlineInfo
                  ? html`<ngv-plugin-cesium-offline
                      .viewer="${this.viewer}"
                      .ionAssetUrl="${this.config.app.cesiumContext
                        .ionAssetUrl}"
                      .cesiumApiUrl="${this.config.app.cesiumContext
                        .cesiumApiUrl}"
                      .info="${offlineInfo}"
                      .beforeSwitchDispatch=${this.beforeSwitchDispatch.bind(
                        this,
                      )}
                      @switch="${(evt: {detail: {offline: boolean}}) => {
                        this.offline = evt.detail.offline;
                      }}"
                      @offlineInfo="${(evt: {detail: OfflineInfo}) => {
                        if (!evt.detail?.view?.id) return;
                        this.offline = true;
                        this.navElement.setViewById(evt.detail.view.id);
                      }}"
                    ></ngv-plugin-cesium-offline>`
                  : ''}
                <ngv-plugin-cesium-navigation
                  .viewer="${this.viewer}"
                  .config="${this.config.app.cesiumContext}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .tiles3dCollection="${this.collections.tiles3d}"
                  .offline="${this.offline}"
                  @viewChanged=${(evt: {
                    detail: IngvCesiumContext['views'][number];
                  }) => this.onViewChanged(evt.detail)}
                ></ngv-plugin-cesium-navigation>
                ${this.showSurvey
                  ? html` <ngv-survey
                      .surveyFields="${this.config.app.survey.fields}"
                      .fieldValues="${this.surveyFieldValues}"
                      @confirm=${(evt: CustomEvent<FieldValues>) => {
                        this.confirm(evt).catch((e) => console.error(e));
                      }}
                      @cancel=${() => {
                        this.cancel();
                      }}
                    ></ngv-survey>`
                  : html`<ngv-layers-list
                      .layers="${this.surveys.map((s) => {
                        return {
                          name: s.id,
                        };
                      })}"
                      .options="${{
                        title: msg('Surveys'),
                        showDeleteBtns: true,
                        showZoomBtns: true,
                        showEditBtns: true,
                      }}"
                      @remove=${async (evt: {detail: number}) =>
                        this.onRemove(evt.detail)}
                      @zoom=${(evt: {detail: number}) => {
                        const id = this.surveys[evt.detail]?.id;
                        if (id) {
                          const ent = this.dataSource.entities.getById(id);
                          // todo decide how and improve
                          const sphere = new BoundingSphere(
                            ent.position.getValue(JulianDate.now()),
                            2,
                          );
                          this.viewer.camera.flyToBoundingSphere(sphere);
                        }
                      }}
                      @edit="${(evt: {detail: number}) =>
                        this.onEdit(evt.detail)}"
                      @zoomEnter=${(e: {detail: number}) => {
                        const id = this.surveys[e.detail]?.id;
                        if (id) {
                          this.highlightEntity(id);
                        }
                      }}
                      @zoomOut=${(e: {detail: number}) => {
                        const id = this.surveys[e.detail]?.id;
                        if (id) {
                          this.removeEntityHighlight(id);
                        }
                      }}
                    ></ngv-layers-list>`}
              `
            : ''}
        </div>

        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.app.cesiumContext}
          @viewerInitialized=${(evt: CustomEvent<ViewerInitializedDetails>) => {
            this.initializeViewer(evt.detail);
          }}
        >
          ${this.viewer
            ? html`<ngv-plugin-cesium-click-info
                .viewer="${this.viewer}"
                .dataSourceCollection="${this.dataSourceCollection}"
                .options=${this.config.app.cesiumContext.clickInfoOptions}
                @action=${(evt: CustomEvent<ClickDetail>) =>
                  this.addMarker(evt.detail)}
              ></ngv-plugin-cesium-click-info>`
            : ''}
        </ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }
}
