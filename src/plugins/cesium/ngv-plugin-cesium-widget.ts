import type {HTMLTemplateResult} from 'lit';
import {LitElement, css, unsafeCSS, html} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

// @ts-expect-error Vite specific ?inline parameter
import style from '@cesium/engine/Source/Widget/CesiumWidget.css?inline';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import type {
  CesiumWidget,
  DataSourceCollection,
  Model,
  PrimitiveCollection,
} from '@cesium/engine';
import {Resource} from '@cesium/engine';
import {initCesiumWidget} from './ngv-cesium-factories.js';
import {getJson, getOrCreateDirectoryChain} from '../../utils/storage-utils.js';
import type {OfflineInfo} from './ngv-plugin-cesium-offline.js';
import {cesiumFetchCustom} from '../../utils/cesium-tileset-downloader.js';
import {cesiumFetchImageCustom} from '../../utils/cesium-imagery-downloader.js';

export type ViewerInitializedDetails = {
  viewer: CesiumWidget;
  dataSourceCollection: DataSourceCollection;
  primitiveCollections: {
    models: PrimitiveCollection;
    tiles3d: PrimitiveCollection;
  };
};

@customElement('ngv-plugin-cesium-widget')
export class NgvPluginCesiumWidget extends LitElement {
  public viewer: CesiumWidget;
  public dataSourceCollection: DataSourceCollection;

  static styles = [
    unsafeCSS(style),
    css`
      :host {
        position: fixed;
        width: 100%;
        height: 100%;
      }
      #globe {
        width: 100%;
        height: 100%;
      }

      .cesium-widget canvas {
        position: absolute;
      }

      .cesium-credit-logoContainer {
        display: none !important;
      }
    `,
  ];

  @property({type: Object})
  cesiumContext: IngvCesiumContext;

  @property({type: Object})
  modelCallback: (name: string, model: Model) => void;

  // The configuration should provide a catalog
  @query('#globe')
  private element: HTMLDivElement;

  private async initCesiumViewer(): Promise<void> {
    // rewrite resource functions before viewer initialized
    if (this.cesiumContext.offline) {
      const dir = await getOrCreateDirectoryChain([this.cesiumContext.name]);
      const info: OfflineInfo = await getJson(
        dir,
        `${this.cesiumContext.offline.infoFilename}.json`,
      );
      if (info) {
        Resource.prototype.fetch = cesiumFetchCustom([
          this.cesiumContext.name,
          this.cesiumContext.offline.tiles3dSubdir,
        ]);
        Resource.prototype.fetchImage = cesiumFetchImageCustom([
          this.cesiumContext.name,
          this.cesiumContext.offline.imagerySubdir,
        ]);
      }
    }
    const {viewer, dataSourceCollection, primitiveCollections} =
      await initCesiumWidget(
        this.element,
        this.cesiumContext,
        this.modelCallback,
      );
    this.viewer = viewer;
    this.dataSourceCollection = dataSourceCollection;
    this.dispatchEvent(
      new CustomEvent<ViewerInitializedDetails>('viewerInitialized', {
        detail: {
          viewer,
          dataSourceCollection,
          primitiveCollections,
        },
      }),
    );
  }

  protected firstUpdated(): void {
    this.initCesiumViewer().catch((e) => {
      console.error('Error during cesium viewer initialization: ', e);
    });
  }

  render(): HTMLTemplateResult {
    return html`<div id="globe"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-widget': NgvPluginCesiumWidget;
  }
}

declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}
