import {customElement, property} from 'lit/decorators.js';
import type {HTMLTemplateResult} from 'lit';
import {css, html, LitElement} from 'lit';
import type {JulianDate} from '@cesium/engine';
import {type CesiumWidget} from '@cesium/engine';
import type {IIlluminationConfig} from './ingv-config-illumination.js';

import '../../plugins/cesium/ngv-plugin-cesium-widget.js';

@customElement('ngv-main-illumination')
export class NgvMainIllumination extends LitElement {
  @property({type: Object})
  config: IIlluminationConfig['app'];
  @property({type: Object}) date: JulianDate;

  private viewer: CesiumWidget;

  static styles = css`
    .app-container {
      width: 100%;
      height: 100%;
    }
  `;

  updated(): void {
    this.viewer.clock.currentTime = this.date;
    console.log(this.date.toString());
  }

  protected render(): HTMLTemplateResult {
    return html`
      <div class="app-container">
        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.cesiumContext}
          @viewerInitialized=${(evt: CustomEvent<CesiumWidget>) => {
            this.viewer = evt.detail;
            this.updated();
          }}
        ></ngv-plugin-cesium-widget>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-main-illumination': NgvMainIllumination;
  }
}
