import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';
import '../../structure/ngv-structure-overlay';

import type {IPermitsConfig} from './ingv-config-permits.js';
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
import type {INGVCesiumModel} from '../../interfaces/cesium/ingv-layers.js';

@customElement('ngv-app-permits')
@localized()
export class NgvAppPermits extends ABaseApp<IPermitsConfig> {
  @state()
  private viewer: CesiumWidget;
  @query('.ngv-vertical-menu')
  private verticalMenu: {show: () => void};
  private uploadedModelsCollection: PrimitiveCollection =
    new PrimitiveCollection();
  private dataSourceCollection: DataSourceCollection;

  private storeOptions = {
    localStoreKey: 'permits-localStoreModels',
    indexDbName: 'permits-uploadedModelsStore',
  };

  private collections: ViewerInitializedDetails['primitiveCollections'];

  constructor() {
    super(() => import('./demoPermitConfig.js'));
  }

  topLeftRender(): HTMLTemplateResult {
    return html` <wa-card class="ngv-toolbar">
      <img src="../../../icons/c2c_logo.svg" alt="logo" />
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

  leftMenuRender(): HTMLTemplateResult {
    return html`<div>
      <wa-details class="ngv-vertical-menu">
        <div class="ngv-vertical-menu-content">
          <ngv-plugin-cesium-model-interact
            .viewer="${this.viewer}"
            .dataSourceCollection="${this.dataSourceCollection}"
            .primitiveCollection="${this.collections.models}"
            .tiles3dCollection="${this.collections.tiles3d}"
            .options="${{listTitle: 'Catalog'}}"
            @chosenModelChanged=${(evt: {detail: INGVCesiumModel}) => {
              if (evt.detail) {
                this.verticalMenu.show();
              }
            }}
          ></ngv-plugin-cesium-model-interact>
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
            @chosenModelChanged=${(evt: {detail: INGVCesiumModel}) => {
              if (evt.detail) {
                this.verticalMenu.show();
              }
            }}
          ></ngv-plugin-cesium-model-interact>

          <ngv-plugin-cesium-navigation
            .viewer="${this.viewer}"
            .config="${this.config.app.cesiumContext}"
            .dataSourceCollection="${this.dataSourceCollection}"
          ></ngv-plugin-cesium-navigation></div
      ></wa-details>
    </div>`;
  }

  render(): HTMLTemplateResult {
    const r = super.render();
    if (r && !this.config) {
      return r;
    }
    return html`
      <ngv-structure-app .config=${this.config}>
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
            ? html`<ngv-structure-overlay>
                <div slot="top-left">${this.topLeftRender()}</div>
                <div slot="menu-left">${this.leftMenuRender()}</div>
                <ngv-plugin-cesium-click-info
                  .viewer="${this.viewer}"
                  .dataSourceCollection="${this.dataSourceCollection}"
                  .options=${this.config.app.cesiumContext.clickInfoOptions}
                ></ngv-plugin-cesium-click-info
              ></ngv-structure-overlay>`
            : ''}
        </ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }

  createRenderRoot(): this {
    return this;
  }
}
