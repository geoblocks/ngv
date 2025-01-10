import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import type {IPermitsConfig} from './ingv-config-permits.js';
import '../../plugins/cesium/ngv-plugin-cesium-widget';
import '../../plugins/cesium/ngv-plugin-cesium-upload';
import '../../plugins/cesium/ngv-plugin-cesium-model-interact';
import '../../plugins/cesium/ngv-plugin-cesium-slicing';
import '../../plugins/cesium/ngv-plugin-cesium-measure';
import '../../plugins/cesium/ngv-plugin-cesium-navigation';
import type {CesiumWidget, DataSourceCollection} from '@cesium/engine';

import {PrimitiveCollection} from '@cesium/engine';
import type {ViewerInitializedDetails} from '../../plugins/cesium/ngv-plugin-cesium-widget.js';

@customElement('ngv-app-permits')
@localized()
export class NgvAppPermits extends ABaseApp<IPermitsConfig> {
  @state()
  private viewer: CesiumWidget;
  private uploadedModelsCollection: PrimitiveCollection =
    new PrimitiveCollection();
  private dataSourceCollection: DataSourceCollection;

  private storeOptions = {
    localStoreKey: 'permits-localStoreModels',
    indexDbName: 'permits-uploadedModelsStore',
  };

  private sliceStoreKey = 'permits-localStoreClipping';

  private collections: ViewerInitializedDetails['primitiveCollections'];

  constructor() {
    super(() => import('./demoPermitConfig.js'));
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
                <ngv-plugin-cesium-model-interact
                  .viewer="${this.viewer}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .primitiveCollection="${this.collections.models}"
                  .tiles3dCollection="${this.collections.tiles3d}"
                  .options="${{listTitle: 'Catalog'}}"
                ></ngv-plugin-cesium-model-interact>
                <div
                  style="width: 100%;border: 1px solid #E0E3E6;margin: 5px 0;"
                ></div>
                <ngv-plugin-cesium-upload
                  .viewer="${this.viewer}"
                  .primitiveCollection="${this.uploadedModelsCollection}"
                  .storeOptions="${this.storeOptions}"
                ></ngv-plugin-cesium-upload>
                <ngv-plugin-cesium-model-interact
                  .viewer="${this.viewer}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .primitiveCollection="${this.uploadedModelsCollection}"
                  .tiles3dCollection="${this.collections.tiles3d}"
                  .storeOptions="${this.storeOptions}"
                  .options="${{listTitle: 'Uploaded models'}}"
                ></ngv-plugin-cesium-model-interact>
                <ngv-plugin-cesium-slicing
                  .viewer="${this.viewer}"
                  .tiles3dCollection="${this.collections.tiles3d}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .storeKey="${this.sliceStoreKey}"
                ></ngv-plugin-cesium-slicing>
                <ngv-plugin-cesium-measure
                  .viewer="${this.viewer}"
                  .dataSourceCollection="${this.dataSourceCollection}"
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
        ></ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }
}
