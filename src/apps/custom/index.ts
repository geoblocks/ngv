import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import './ngv-main-custom.js';

import type {CustomConfig} from './ingv-config-custom.js';

@customElement('ngv-app-custom')
@localized()
export class NgvAppCustom extends ABaseApp<CustomConfig> {
  constructor() {
    super(() => import('./customConfig.js'));
  }

  render(): HTMLTemplateResult {
    const r = super.render();
    if (r && !this.config) {
      // todo check
      return r;
    }
    return html`
      <ngv-structure-app exportparts="language-chooser" .config=${this.config}>
        <ngv-main-custom .config=${this.config?.app}></ngv-main-custom>
      </ngv-structure-app>
    `;
  }
}
