import type {HTMLTemplateResult} from 'lit';
import {css} from 'lit';
import {html} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';
import {localized, msg} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';
import '../../structure/ngv-structure-overlay';

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
import {
  getJson as readJsonFile,
  getOrCreateDirectoryChain,
  persistJson,
  removeFile,
} from '../../utils/storage-utils.js';
import type {FieldValues} from '../../utils/generalTypes.js';
import {Task} from '@lit/task';
import type {OfflineInfo} from '../../plugins/cesium/ngv-plugin-cesium-offline.js';
import type {NgvPluginCesiumNavigation} from '../../plugins/cesium/ngv-plugin-cesium-navigation.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import {poolRunner} from '../../utils/pool-runner.js';
import type {LabelValue, SurveyField} from '../../interfaces/ui/ingv-survey.js';
import type {config} from './demoSurveyConfig.js';
import {classMap} from 'lit/directives/class-map.js';

type ItemSummary =
  typeof config extends ISurveyConfig<infer I, any> ? I : never;
type Item = typeof config extends ISurveyConfig<any, infer I> ? I : never;

const STORAGE_DIR = ['surveys'];
const STORAGE_LIST_NAME = 'surveys.json';

@customElement('ngv-app-survey')
@localized()
export class NgvAppSurvey extends ABaseApp<typeof config> {
  @state()
  private viewer: CesiumWidget;
  @state()
  private showSurvey = false;
  @state()
  private surveys: ItemSummary[] = [];
  @state()
  private failedSurveys: ItemSummary[] = [];
  @state()
  private offline: boolean = false;
  @state()
  private initialized = false;
  @state()
  private surveyFieldValuesPromise: Promise<FieldValues> | undefined;
  @query('ngv-plugin-cesium-navigation')
  private navElement: NgvPluginCesiumNavigation;
  @query('.ngv-vertical-menu')
  private verticalMenu: {show: () => void};
  private dataSourceCollection: DataSourceCollection;
  private dataSource: CustomDataSource = new CustomDataSource();
  private lastPoint: Entity | undefined;
  private persistentDir: FileSystemDirectoryHandle;
  private pointConfig: PointGraphics.ConstructorOptions;
  private pointHighlightConfig: PointGraphics.ConstructorOptions;
  private eventHandler: ScreenSpaceEventHandler | null = null;
  private currentView: IngvCesiumContext['views'][number] | null = null;

  private collections: ViewerInitializedDetails['primitiveCollections'];

  static styles = css`
    details {
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      padding: 8px 16px;
      user-select: none;
    }
    summary {
      cursor: pointer;
    }
  `;

  constructor() {
    super(() => import('./demoSurveyConfig.js'));
  }

  async resolveFieldsConfig(
    offline: boolean,
    surveyFields: SurveyField[],
  ): Promise<void> {
    const promises = surveyFields.map((v) => {
      if (
        (v.type !== 'select' &&
          v.type !== 'radio' &&
          v.type !== 'checkbox' &&
          v.type !== 'readonly') ||
        typeof v.options !== 'function'
      ) {
        return null;
      }
      const filename = `field-${v.id}.json`;
      if (offline) {
        return readJsonFile<LabelValue[]>(this.persistentDir, filename).then(
          (result) => (v.options = result),
        );
      }
      return v.options().then(async (result) => {
        v.options = result;
        await persistJson(this.persistentDir, filename, result);
        return result;
      });
    });
    await Promise.all(promises);
  }

  // @ts-expect-error TS6133
  private _showSurveyChange = new Task(this, {
    args: (): [boolean] => [this.showSurvey],
    task: ([showSurvey]) => {
      if (showSurvey) {
        this.verticalMenu.show();
      }
    },
  });

  // @ts-expect-error TS6133
  private _configChange = new Task(this, {
    args: (): [typeof config, ItemSummary[]] => [this.config, this.surveys],
    task: async ([config, _surveys]) => {
      if (config.app.cesiumContext.offline) {
        const appName = config.app.cesiumContext.name;
        this.offline = localStorage.getItem(`${appName}_offline`) === 'true';
      }

      this.persistentDir = await getOrCreateDirectoryChain([
        this.config.app.cesiumContext.name,
        // we have only a global persistence to simplify initialization
        // this.currentView.id,
        ...STORAGE_DIR,
      ]);

      const pointConf = config.app.cesiumContext.surveyOptions?.pointOptions;
      this.pointConfig = {
        color: pointConf?.color
          ? typeof pointConf.color === 'string'
            ? Color.fromCssColorString(pointConf?.color)
            : pointConf.color
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
      await this.resolveFieldsConfig(this.offline, config.app.survey.fields);
      this.initialized = true;
    },
  });

  async loadSurveys(offline: boolean): Promise<void> {
    if (!this.persistentDir) {
      console.error('Directory not defined.');
      return;
    }
    if (!offline && this.config.app.survey.listItems) {
      this.surveys = await this.config.app.survey.listItems({
        id: this.currentView.id,
      });
      await persistJson(this.persistentDir, STORAGE_LIST_NAME, this.surveys);
      console.log('Persisted surveys');
    } else {
      console.log('Reading surveys from storage');
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
      this.addPoint(position, s.id, s);
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
        this.editSurvey(pickedObject?.id?.id);
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );
  }

  addPoint(position: Cartesian3, id?: string, item?: ItemSummary): Entity {
    const entExists = id && this.dataSource.entities.getById(id);
    if (entExists) return entExists;
    let color = this.pointConfig.color;
    const colorCallback =
      this.config.app.cesiumContext.surveyOptions?.pointOptions.colorCallback;
    if (item && colorCallback) {
      color = colorCallback(item);
    }
    return this.dataSource.entities.add({
      id,
      position,
      point: {...this.pointConfig, color},
    });
  }

  addMarker(detail: ClickDetail): void {
    if (this.lastPoint) this.cancel();
    this.lastPoint = this.addPoint(detail.cartesian3);
    this.showSurvey = true;
    const idField = this.config.app.survey.fields.find((f) => f.type === 'id');
    const fields: FieldValues = {};
    if (idField) {
      fields[idField.id] = this.lastPoint.id;
    }
    const coordsField = this.config.app.survey.fields.find(
      (f) => f.type === 'coordinates',
    );
    if (coordsField) {
      fields[coordsField.id] = {
        wgs84: [
          detail.wgs84.longitude,
          detail.wgs84.latitude,
          detail.elevation,
        ],
        projected: detail.projected && [
          detail.projected.longitude,
          detail.projected.latitude,
          detail.elevation,
        ],
      };
    }
    const requiredDateField = this.config.app.survey.fields.find(
      (f) =>
        f.type === 'input' && f.inputType === 'datetime-local' && f.required,
    );
    if (requiredDateField) {
      fields[requiredDateField.id] = new Date().toISOString().split('.')[0];
    }
    // converting to get missing properties
    const item = this.config.app.survey.fieldsToItem(
      fields,
      this.currentView.id,
      this.surveys.length + 1,
    );
    this.surveyFieldValuesPromise = Promise.resolve(
      this.config.app.survey.itemToFields(item),
    );
  }

  hideSurvey(): void {
    this.showSurvey = false;
    this.lastPoint = undefined;
    this.surveyFieldValuesPromise = undefined;
  }

  async confirm(evt: CustomEvent<FieldValues>): Promise<void> {
    if (!evt.detail) throw new Error('No survey data');
    const idField = this.config.app.survey.fields.find((f) => f.type === 'id');
    let id = <string>evt.detail[idField?.id];
    if (!id) return;
    const surveyIndex = this.surveys.findIndex((s) => s.id === id);
    const itemNumber =
      surveyIndex < 0 ? this.surveys.length + 1 : surveyIndex + 1;
    const item = this.config.app.survey.fieldsToItem(
      evt.detail,
      this.currentView.id,
      itemNumber,
    );
    item.modifiedOffline = this.offline;
    if (surveyIndex < 0) {
      this.surveys.push(item);
    } else {
      this.surveys[surveyIndex] = item;
    }
    if (this.offline) {
      await persistJson(this.persistentDir, STORAGE_LIST_NAME, this.surveys);
      await persistJson(this.persistentDir, `${id}.json`, item);
    } else {
      const res = await this.config.app.survey.saveItem(item);
      id = res.id;
    }
    if (this.lastPoint) {
      const position = this.lastPoint.position.getValue();
      this.dataSource.entities.remove(this.lastPoint);
      this.addPoint(position, id, item);
    } else {
      const colorCallback =
        this.config.app.cesiumContext.surveyOptions?.pointOptions.colorCallback;
      if (item && colorCallback) {
        const entity = this.dataSource.entities.getById(item.id);
        if (entity) {
          entity.point.color = new ConstantProperty(colorCallback(item));
        }
      }
    }
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
      const entity = this.dataSource.entities.getById(id);
      if (entity) {
        this.dataSource.entities.remove(entity);
      }
    }
  }

  onEdit(index: number): void {
    const id = this.surveys[index]?.id;
    this.editSurvey(id);
  }

  async onViewChanged(view: IngvCesiumContext['views'][number]): Promise<void> {
    if (!view) return;
    this.currentView = view;
    await this.loadSurveys(this.offline);
  }

  editSurvey(id: string): void {
    if (!id) {
      return;
    }
    this.showSurvey = true;
    this.surveyFieldValuesPromise = this.getOrReadSurvey(id);
  }
  async getOrReadSurvey(id: string): Promise<FieldValues> {
    let item: Item;
    if (this.offline) {
      item = await readJsonFile<Item>(this.persistentDir, `${id}.json`);
    } else {
      item = await this.config.app.survey.getItem({id});
    }
    return this.config.app.survey.itemToFields(item);
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

  removeEntityHighlight(id: string, item: ItemSummary): void {
    const ent = this.dataSource.entities.getById(id);
    if (!ent) return;
    const colorCallback =
      this.config.app.cesiumContext.surveyOptions?.pointOptions.colorCallback;
    ent.point.color = new ConstantProperty(
      item && colorCallback ? colorCallback(item) : this.pointConfig.color,
    );
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
      await this.loadSurveys(!goingOffline);
      // download all the survey items
      await poolRunner({
        concurrency: 7,
        tasks: this.surveys,
        runTask: async (s) => {
          const item = await this.config.app.survey.getItem({id: s.id});
          await persistJson(this.persistentDir, `${item.id}.json`, item);
          console.log('->', `${item.id}.json`, item);
          // FIXME: here we can download all the photos (or append to a list to be downloaded later)
        },
        // no signal, we could allow to cancel
      });
    } else {
      // going online
      const modifiedSurveys = this.surveys.filter((s) => s.modifiedOffline);
      this.failedSurveys = [];
      await Promise.all(
        modifiedSurveys.map(async (s) => {
          try {
            console.log(`Sync survey ${s.id}`, s);
            const survey = await readJsonFile<Item>(
              this.persistentDir,
              `${s.id}.json`,
            );
            // Should item be created or updated handles in saveItem function
            // For now, all items modified in offline mode will be updated in DB. Latter modified_at check can be added.
            await this.config.app.survey.saveItem(survey);
          } catch (error) {
            console.error(`Survey ${s.id} sync failed with error:`, error);
            this.failedSurveys.push(s);
          }
        }),
      ).finally(() => {
        this.requestUpdate();
        if (this.failedSurveys.length > 0) {
          console.log(this.failedSurveys);
          throw new Error(`Surveys sync failed.`);
        }
      });
    }
  }

  disconnectedCallback(): void {
    this.eventHandler.destroy();
    this.dataSourceCollection.destroy();
    super.disconnectedCallback();
  }

  topLeftRender(): HTMLTemplateResult {
    return html`<wa-card class="ngv-toolbar">
      <div class="ngv-tools-icon-container">
        <img src="../../../icons/hes_logo.svg" alt="logo" />
      </div>
      <div class="ngv-tools-btns">
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
      </div>
    </wa-card>`;
  }

  renderSurveysList(surveys: ItemSummary[], title: string): HTMLTemplateResult {
    return html` <div .hidden=${!surveys?.length || this.showSurvey}>
      <wa-card
        with-header
        class="${classMap({
          'wa-visually-hidden': !surveys?.length || this.showSurvey,
        })}"
      >
        <div slot="header">${title}</div>
        <ngv-layers-list
          .layers="${surveys.map((s) => {
            return {
              name: s.title ? `${s.id}:${s.title}` : s.id,
            };
          })}"
          .options="${{
            showDeleteBtnCallback: (i: number) => !Number(surveys[i]?.id),
            showZoomBtns: true,
            showEditBtns: true,
          }}"
          @remove=${async (evt: {detail: number}) => this.onRemove(evt.detail)}
          @zoom=${(evt: {detail: number}) => {
            const id = surveys[evt.detail]?.id;
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
          @edit="${(evt: {detail: number}) => this.onEdit(evt.detail)}"
          @zoomEnter=${(e: {detail: number}) => {
            const id = surveys[e.detail]?.id;
            if (id) {
              this.highlightEntity(id);
            }
          }}
          @zoomOut=${(e: {detail: number}) => {
            const id = surveys[e.detail]?.id;
            if (id) {
              this.removeEntityHighlight(id, surveys[e.detail]);
            }
          }}
        ></ngv-layers-list>
      </wa-card>
    </div>`;
  }

  leftMenuContentRender(): HTMLTemplateResult {
    const offlineInfo: OfflineInfo = this.config.app.cesiumContext.offline
      ? {
          appName: this.config.app.cesiumContext.name,
          view: this.currentView,
          ...this.config.app.cesiumContext.offline,
        }
      : undefined;

    return html`<div>
      <wa-details class="ngv-vertical-menu">
        <div class="ngv-vertical-menu-content">
          ${offlineInfo
            ? html`<ngv-plugin-cesium-offline
                .hidden=${this.showSurvey}
                .viewer="${this.viewer}"
                .ionAssetUrl="${this.config.app.cesiumContext.ionAssetUrl}"
                .cesiumApiUrl="${this.config.app.cesiumContext.cesiumApiUrl}"
                .info="${offlineInfo}"
                .beforeSwitchDispatch=${this.beforeSwitchDispatch.bind(this)}
                @switch="${(evt: {detail: {offline: boolean}}) => {
                  this.offline = evt.detail.offline;
                  if (!this.offline) {
                    this.loadSurveys(this.offline).catch((e) =>
                      console.error(e),
                    );
                  }
                }}"
                @offlineInfo="${(evt: {detail: OfflineInfo}) => {
                  if (!evt.detail?.view?.id) return;
                  this.offline = true;
                  this.navElement.setViewById(evt.detail.view.id);
                }}"
              ></ngv-plugin-cesium-offline>`
            : ''}
          <ngv-survey
            .hidden=${!this.showSurvey}
            .surveyFields="${this.config.app.survey.fields}"
            .fetchFieldValues="${this.surveyFieldValuesPromise}"
            .projection=${this.config.app.cesiumContext.clickInfoOptions
              ?.projection}
            @confirm=${(evt: CustomEvent<FieldValues>) => {
              this.confirm(evt).catch((e) => console.error(e));
            }}
            @cancel=${() => {
              this.cancel();
            }}
          ></ngv-survey>
          <ngv-plugin-cesium-navigation
            .hidden=${this.showSurvey}
            .viewer="${this.viewer}"
            .config="${this.config.app.cesiumContext}"
            .dataSourceCollection="${this.dataSourceCollection}"
            .tiles3dCollection="${this.collections.tiles3d}"
            .offline="${this.offline}"
            @viewChanged=${(evt: {
              detail: IngvCesiumContext['views'][number];
            }) => this.onViewChanged(evt.detail)}
          ></ngv-plugin-cesium-navigation>
          ${this.renderSurveysList(
            this.failedSurveys,
            msg('Failed sync surveys'),
          )}
          ${this.renderSurveysList(this.surveys, msg('Surveys'))}
        </div>
      </wa-details>
    </div>`;
  }

  render(): HTMLTemplateResult {
    const r = super.render();
    if ((r && !this.config) || !this.initialized) {
      return r;
    }
    return html`
      <ngv-structure-app .config=${this.config}>
        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.app.cesiumContext}
          @viewerInitialized=${(evt: CustomEvent<ViewerInitializedDetails>) => {
            this.initializeViewer(evt.detail);
          }}
        >
          ${this.viewer
            ? html` <ngv-structure-overlay>
                <div slot="top-left">${this.topLeftRender()}</div>
                <div slot="menu-left">${this.leftMenuContentRender()}</div>
                <ngv-plugin-cesium-click-info
                  .viewer="${this.viewer}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .options=${this.config.app.cesiumContext.clickInfoOptions}
                  @action=${(evt: CustomEvent<ClickDetail>) =>
                    this.addMarker(evt.detail)}
                ></ngv-plugin-cesium-click-info>
              </ngv-structure-overlay>`
            : ''}
        </ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }

  createRenderRoot(): this {
    return this;
  }
}
