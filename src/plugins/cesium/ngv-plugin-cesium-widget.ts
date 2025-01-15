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
import {initCesiumWidget} from './ngv-cesium-factories.js';

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
