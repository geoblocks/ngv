import type {HTMLTemplateResult} from 'lit';
import {LitElement, css, unsafeCSS, html} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

// @ts-expect-error Vite specific ?inline parameter
import style from '@cesium/engine/Source/Widget/CesiumWidget.css?inline';
import type {IngvCesiumContext} from 'src/interfaces/ingv-cesium-context.js';
import type {CesiumWidget, Model} from '@cesium/engine';
import {initCesiumWidget} from './ngv-cesium-factories.js';

@customElement('ngv-plugin-cesium-widget')
export class NgvPluginCesiumWidget extends LitElement {
  public viewer: CesiumWidget;

  static styles = css`
    ${unsafeCSS(style)}

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
  `;

  @property({type: Object})
  cesiumContext: IngvCesiumContext;

  @property({type: Object})
  modelCallback: (name: string, model: Model) => void;

  // The configuration should provide a catalog
  @query('#globe')
  private element: HTMLDivElement;

  private async initCesiumViewer(): Promise<void> {
    this.viewer = await initCesiumWidget(
      this.element,
      this.cesiumContext,
      this.modelCallback,
    );
    this.dispatchEvent(
      new CustomEvent('viewerInitialized', {
        detail: this.viewer,
      }),
    );
  }

  protected firstUpdated(): void {
    this.initCesiumViewer().catch((e) => {
      console.error('Error during cesium viewer initialization: ', e);
    });
  }

  render(): HTMLTemplateResult {
    return html`<div id="globe"></div>`;
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
