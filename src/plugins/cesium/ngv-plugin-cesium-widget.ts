import type {HTMLTemplateResult} from 'lit';
import {LitElement, css, unsafeCSS, html} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

// @ts-expect-error Vite specific ?inline parameter
import style from '@cesium/engine/Source/Widget/CesiumWidget.css?inline';
import type {IngvCesiumContext} from 'src/interfaces/ingv-cesium-context.js';
import type {CesiumWidget} from '@cesium/engine';
import {initCesiumWidget} from './ngv-cesium-factories.js';

@customElement('ngv-plugin-cesium-widget')
export class NgvPluginCesiumWidget extends LitElement {
  public viewer: CesiumWidget;

  static styles = css`
    ${unsafeCSS(style)}

    :host {
      width: 100%;
      height: 100%;
      display: block;
    }
    .cesium-credit-logoContainer {
      display: none !important;
    }
  `;

  @property({type: Object})
  cesiumContext: IngvCesiumContext;

  // The configuration should provide a catalog
  @query('#globe')
  private element: HTMLDivElement;

  private async initCesiumViewer(): Promise<void> {
    this.viewer = await initCesiumWidget(this.element, this.cesiumContext);
    this.dispatchEvent(
      new CustomEvent('viewerInitialized', {
        detail: this.viewer,
      }),
    );
  }

  protected firstUpdated(): void {
    this.initCesiumViewer().catch(() => {
      // FIXME: displatch an error?
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
