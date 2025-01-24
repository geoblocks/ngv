import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import type {ISurveyConfig} from './ingv-config-survey.js';
import '../../plugins/cesium/ngv-plugin-cesium-widget';
import '../../plugins/cesium/ngv-plugin-cesium-upload';
import '../../plugins/cesium/ngv-plugin-cesium-model-interact';
import '../../plugins/cesium/ngv-plugin-cesium-slicing';
import '../../plugins/cesium/ngv-plugin-cesium-measure';
import '../../plugins/cesium/ngv-plugin-cesium-navigation';
import '../../plugins/cesium/ngv-plugin-cesium-click-info';
import '../../plugins/ui/ngv-survey';
import type {CesiumWidget, DataSourceCollection, Entity} from '@cesium/engine';
import {Color, HeightReference} from '@cesium/engine';
import {CustomDataSource} from '@cesium/engine';
import type {ViewerInitializedDetails} from '../../plugins/cesium/ngv-plugin-cesium-widget.js';
import type {ClickDetail} from '../../plugins/cesium/ngv-plugin-cesium-click-info.js';

@customElement('ngv-app-survey')
@localized()
export class NgvAppSurvey extends ABaseApp<ISurveyConfig> {
  @state()
  private viewer: CesiumWidget;
  @state()
  private showSurvey = false;
  private dataSourceCollection: DataSourceCollection;
  private dataSource: CustomDataSource = new CustomDataSource();
  private lastPoint: Entity | undefined;

  private collections: ViewerInitializedDetails['primitiveCollections'];
  private surveyFieldValues:
    | Record<string, string | number | Record<string, boolean>>
    | undefined = {};

  constructor() {
    super(() => import('./demoSurveyConfig.js'));
  }

  addMarker(detail: ClickDetail): void {
    // todo make configurable
    this.lastPoint = this.dataSource.entities.add({
      position: detail.cartesian3,
      point: {
        color: Color.RED,
        outlineWidth: 2,
        pixelSize: 5,
        heightReference: HeightReference.NONE,
      },
    });
    this.showSurvey = true;
    // todo improve: how to configure?
    this.surveyFieldValues['textInput'] =
      `${detail.projected.longitude}, ${detail.projected.latitude}`;
  }

  hideSurvey(): void {
    this.showSurvey = false;
    this.lastPoint = undefined;
    this.surveyFieldValues = {};
  }

  render(): HTMLTemplateResult {
    const r = super.render();
    if (r && !this.config) {
      return r;
    }
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
                <ngv-plugin-cesium-navigation
                  .viewer="${this.viewer}"
                  .viewsConfig="${this.config.app.cesiumContext.views}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                ></ngv-plugin-cesium-navigation>
                ${this.showSurvey
                  ? html` <ngv-survey
                      .surveyConfig="${this.config.app.survey}"
                      .fieldValues="${this.surveyFieldValues}"
                      @confirm=${(evt: CustomEvent) => {
                        console.log(evt.detail);
                        this.hideSurvey();
                      }}
                      @cancel=${() => {
                        this.dataSource.entities.remove(this.lastPoint);
                        this.hideSurvey();
                      }}
                    ></ngv-survey>`
                  : ''}
              `
            : ''}
        </div>

        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.app.cesiumContext}
          @viewerInitialized=${(evt: CustomEvent<ViewerInitializedDetails>) => {
            this.viewer = evt.detail.viewer;
            this.dataSourceCollection = evt.detail.dataSourceCollection;
            this.dataSourceCollection
              .add(this.dataSource)
              .catch((e) => console.error(e));
            this.collections = evt.detail.primitiveCollections;
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
