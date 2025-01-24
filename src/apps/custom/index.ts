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
import {downloadAndPersistTileset} from '../../utils/cesium-tileset-downloader.js';
import {getOrCreateDirectoryChain} from '../../utils/storage-utils.js';

import {listDirectoryContents} from '../../utils/debug-utils.js';

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
      <button
        @click="${async () => {
          await downloadAndPersistTileset({
            appName: 'test',
            concurrency: 3,
            tilesetBasePath: 'http://localhost:8000/',
            tilesetName: 'clip-test',
          });
          const testDir = await getOrCreateDirectoryChain(['test']);
          await listDirectoryContents(testDir, 10);
        }}"
      >
        Press this!
      </button>
      <ngv-structure-app .config=${this.config}>
        <ngv-main-custom .config=${this.config?.app}></ngv-main-custom>
      </ngv-structure-app>
    `;
  }
}
