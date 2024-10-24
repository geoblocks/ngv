import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import './ngv-main-illumination.js';
import './ngv-menu-illumination.js';
import type {MenuIlluminationChangeDetail} from './ngv-menu-illumination.js';

import type {IIlluminationConfig} from './ingv-config-illumination.js';
import {JulianDate} from '@cesium/engine';

@customElement('ngv-app-illumination')
@localized()
export class NgvAppIllumination extends ABaseApp<IIlluminationConfig> {
  private initialDate = new Date();
  @state() date = JulianDate.fromDate(this.initialDate);

  constructor() {
    super(() => import('./demoIlluminationConfig.js'));
  }

  render(): HTMLTemplateResult {
    const r = super.render();
    if (r && !this.config) {
      // todo check
      return r;
    }
    return html`
      <ngv-structure-app .config=${this.config}>
        <ngv-menu-illumination
          .date=${this.initialDate}
          slot="menu"
          @change=${(evt: CustomEvent<MenuIlluminationChangeDetail>) => {
            this.date = evt.detail.date;
          }}
        ></ngv-menu-illumination>
        <ngv-main-illumination
          .config=${this.config?.app}
          .date=${this.date}
        ></ngv-main-illumination>
      </ngv-structure-app>
    `;
  }
}
