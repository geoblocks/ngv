import {html} from 'lit';
import {customElement} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';
import {INgvStructureApp} from '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized, msg} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

// @ts-expect-error viteJS specific import
import configUrl from './defaultConfig.json?url';
//

@customElement('ngv-app-permits')
@localized()
export class NgvAppPermits extends ABaseApp<INgvStructureApp> {
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
        ${msg('THIS IS A CRAZY BUILDINGS app')}
      </ngv-structure-app>
    `;
  }
}
