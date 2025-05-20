import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';
import '../../structure/ngv-structure-overlay';

import './ngv-menu-illumination.js';
import type {MenuIlluminationChangeDetail} from './ngv-menu-illumination.js';

import type {IIlluminationConfig} from './ingv-config-illumination.js';
import {type CesiumWidget, JulianDate} from '@cesium/engine';
import '../../plugins/cesium/ngv-plugin-cesium-widget.js';
import type {ViewerInitializedDetails} from '../../plugins/cesium/ngv-plugin-cesium-widget.js';

@customElement('ngv-app-illumination')
@localized()
export class NgvAppIllumination extends ABaseApp<IIlluminationConfig> {
  @state()
  private viewer: CesiumWidget;
  private initialDate = new Date();
  @state() date = JulianDate.fromDate(this.initialDate);

  constructor() {
    super(() => import('./demoIlluminationConfig.js'));
  }

  updated(): void {
    if (!this.viewer?.clock) return;
    this.viewer.clock.currentTime = this.date;
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
            this.updated();
          }}
        >
          <ngv-structure-overlay>
            <div slot="top-left">
              <wa-card class="ngv-toolbar">
                <img src="../../../icons/c2c_logo.svg" alt="logo" />
                <ngv-menu-illumination
                  .date=${this.initialDate}
                  @change=${(
                    evt: CustomEvent<MenuIlluminationChangeDetail>,
                  ) => {
                    this.date = evt.detail.date;
                  }}
                ></ngv-menu-illumination>
              </wa-card>
            </div>
          </ngv-structure-overlay>
        </ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }

  createRenderRoot(): this {
    return this;
  }
}
