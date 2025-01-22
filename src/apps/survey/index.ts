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
import type {CesiumWidget, DataSourceCollection} from '@cesium/engine';

import {PrimitiveCollection} from '@cesium/engine';
import type {ViewerInitializedDetails} from '../../plugins/cesium/ngv-plugin-cesium-widget.js';

@customElement('ngv-app-survey')
@localized()
export class NgvAppSurvey extends ABaseApp<ISurveyConfig> {
  @state()
  private viewer: CesiumWidget;
  private uploadedModelsCollection: PrimitiveCollection =
    new PrimitiveCollection();
  private dataSourceCollection: DataSourceCollection;

  private collections: ViewerInitializedDetails['primitiveCollections'];

  constructor() {
    super(() => import('./demoSurveyConfig.js'));
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
              `
            : ''}
        </div>

        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.app.cesiumContext}
          @viewerInitialized=${(evt: CustomEvent<ViewerInitializedDetails>) => {
            this.viewer = evt.detail.viewer;
            this.viewer.scene.primitives.add(this.uploadedModelsCollection);
            this.dataSourceCollection = evt.detail.dataSourceCollection;
            this.collections = evt.detail.primitiveCollections;
          }}
        >
          ${this.viewer
            ? html`<ngv-plugin-cesium-click-info
                .viewer="${this.viewer}"
                .dataSourceCollection="${this.dataSourceCollection}"
                .options=${this.config.app.cesiumContext.clickInfoOptions}
              ></ngv-plugin-cesium-click-info>`
            : ''}
        </ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }
}
