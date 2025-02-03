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

import {listDirectoryContents} from '../../utils/debug-utils.js';
import {Rectangle, UrlTemplateImageryProvider} from '@cesium/engine';
import {listTilesInRectangle} from '../../plugins/cesium/cesium-utils.js';
import {downloadAndPersistImageTiles} from '../../utils/cesium-imagery-downloader.js';

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
          const imageryProvider = new UrlTemplateImageryProvider({
            url: 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}',
            customTags: {
              layer() {
                return 'ch.swisstopo.swissimage';
              },
              timestamp() {
                return 'current';
              },
              format() {
                return 'jpeg';
              },
            },
            maximumLevel: 16,
          });

          const rectangle = Rectangle.fromDegrees(
            // EPFL, check that in map.geoadmin.ch
            6.559494,
            46.515362,
            6.57846,
            46.524816,
          );
          const tiles = listTilesInRectangle(rectangle, imageryProvider);

          console.assert(
            tiles.length === 32,
            'Incorrect number of tiles ' + tiles.length,
          );

          await downloadAndPersistImageTiles({
            appName: 'test',
            concurrency: 3,
            imageryProvider,
            prefix: 'swissimage',
            tiles: tiles,
          });

          await listDirectoryContents(
            await navigator.storage.getDirectory(),
            5,
          );
        }}"
      >
        Offline imageries
      </button>
      <ngv-structure-app .config=${this.config}>
        <ngv-main-custom .config=${this.config?.app}></ngv-main-custom>
      </ngv-structure-app>
    `;
  }
}
