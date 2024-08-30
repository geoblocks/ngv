import {html} from 'lit';
import {customElement} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

// @ts-expect-error viteJS specific import
import configUrl from './defaultConfig.json?url';

import './ngv-main-illumination.js';
import {IIlluminationConfig} from './ingv-config-illumination.js';

@customElement('ngv-app-illumination')
@localized()
export class NgvAppIllumination extends ABaseApp<IIlluminationConfig> {
  constructor() {
    super(configUrl as string);
  }

  render() {
    const r = super.render();
    if (r) {
      return r;
    }
    return html`
      <ngv-structure-app .config=${this.config}>
        <ngv-main-illumination
          .config=${this.config.app}
        ></ngv-main-illumination>
      </ngv-structure-app>
    `;
  }
}
