import {customElement, property} from 'lit/decorators.js';
import type {HTMLTemplateResult} from 'lit';
import {html, LitElement} from 'lit';
import type {CustomConfig} from './ingv-config-custom.js';

import '../../plugins/cesium/ngv-plugin-cesium-widget.js';

@customElement('ngv-main-illumination')
export class NgvMainCustom extends LitElement {
  @property({type: Object})
  config: CustomConfig['app'];

  protected render(): HTMLTemplateResult {
    return html` <div class="app-container">Nice app implementation</div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-main-custom': NgvMainCustom;
  }
}
