import {LitElement, css, unsafeCSS, html} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

// @ts-expect-error Vite specific ?inline parameter
import style from '@cesium/engine/Source/Widget/CesiumWidget.css?inline';
import {IngvCesiumContext} from 'src/interfaces/ingv-cesium-context.js';
import {CesiumWidget} from '@cesium/engine';
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

  protected async firstUpdated(): Promise<void> {
    this.viewer = await initCesiumWidget(this.element, this.cesiumContext);
  }

  render() {
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