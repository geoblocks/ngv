import type {HTMLTemplateResult, TemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';
import {localized, msg} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import type {ISurveyConfig} from './ingv-config-survey.js';
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
  getJson,
  getOrCreateDirectoryChain,
  persistJson,
  removeFile,
} from '../../utils/storage-utils.js';
import type {Coordinate} from '../../utils/generalTypes.js';
import proj4 from 'proj4';
import {Task} from '@lit/task';
import type {OfflineInfo} from '../../plugins/cesium/ngv-plugin-cesium-offline.js';
import type {NgvPluginCesiumNavigation} from '../../plugins/cesium/ngv-plugin-cesium-navigation.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';

const STORAGE_DIR = ['surveys'];
const STORAGE_LIST_NAME = 'surveys.json';

type SurveysListItem = {
  id: string;
  coordinate: Coordinate;
};

@customElement('ngv-app-survey')
@localized()
export class NgvAppSurvey extends ABaseApp<ISurveyConfig> {
  @state()
  private viewer: CesiumWidget;
  @state()
  private showSurvey = false;
  @state()
  private surveys: SurveysListItem[] = [];
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
      console.error('Directory not defined.');
      return;
    }
    this.dataSource.entities.removeAll();
    this.surveys =
      (await getJson<SurveysListItem[]>(
        this.persistentDir,
        STORAGE_LIST_NAME,
      )) || [];
    const projection =
      this.config.app.cesiumContext.clickInfoOptions?.projection;
    const transform = projection && proj4(projection, 'EPSG:4326');
    this.surveys.forEach((s) => {
      const coords = {...s.coordinate};
      if (transform) {
        const projectedCoords = transform.forward([
          coords.longitude,
          coords.latitude,
        ]);
        coords.longitude = projectedCoords[0];
        coords.latitude = projectedCoords[1];
      }
      const position = Cartesian3.fromDegrees(
        coords.longitude,
        coords.latitude,
        coords.height,
      );
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
    const idField = this.config.app.survey.find((f) => f.type === 'id');
    if (idField) {
      this.surveyFieldValues[idField.id] = this.lastPoint.id;
    }
    const coordsFiled = this.config.app.survey.find(
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
    const idField = this.config.app.survey.find((f) => f.type === 'id');
    const id = <string>this.surveyFieldValues[idField?.id];
    const coordinatesField = this.config.app.survey.find(
      (f) => f.type === 'coordinates',
    );
    const coordinate = <Coordinate>this.surveyFieldValues[coordinatesField?.id];
    if (!id) return;
    if (!this.surveys.find((s) => s.id === id)) {
      this.surveys.push({id, coordinate});
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
    const survey = await getJson<FieldValues>(this.persistentDir, `${id}.json`);
    if (survey) {
      this.surveyFieldValues = survey;
      this.showSurvey = true;
    }
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
                      .info="${offlineInfo}"
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
                  .viewsConfig="${this.config.app.cesiumContext.views}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .disableViewChange="${this.offline}"
                  @viewChanged=${(evt: {
                    detail: IngvCesiumContext['views'][number];
                  }) => this.onViewChanged(evt.detail)}
                ></ngv-plugin-cesium-navigation>
                ${this.showSurvey
                  ? html` <ngv-survey
                      .surveyConfig="${this.config.app.survey}"
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
