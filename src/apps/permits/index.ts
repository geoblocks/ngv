import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import type {IPermitsConfig} from './ingv-config-permits.js';
import '../../plugins/cesium/ngv-plugin-cesium-widget';
import type {CesiumWidget} from '@cesium/engine';
//

@customElement('ngv-app-permits')
@localized()
export class NgvAppPermits extends ABaseApp<IPermitsConfig> {
  // @ts-expect-error unused for now
  private viewer: CesiumWidget;

  constructor() {
    super(() => import('./demoPermitConfig.js'));
  }

  render(): HTMLTemplateResult {
    const r = super.render();
    if (r) {
      return r;
    }
    return html`
      <ngv-structure-app .config=${this.config}>
        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.app.cesiumContext}
          @viewerInitialized=${(evt: CustomEvent<CesiumWidget>) => {
            this.viewer = evt.detail;
          }}
        ></ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }
}
