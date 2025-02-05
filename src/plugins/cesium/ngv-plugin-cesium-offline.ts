import {customElement, property, state} from 'lit/decorators.js';
import {css, html, LitElement} from 'lit';
import {msg} from '@lit/localize';
import {
  getJson,
  getOrCreateDirectoryChain,
  persistJson,
  removeDirectory,
  removeFile,
} from '../../utils/storage-utils.js';
import {
  cesiumFetchCustom,
  cesiumFetchOrig,
  downloadAndPersistTileset,
} from '../../utils/cesium-tileset-downloader.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import type {INGVCatalog} from '../../interfaces/cesium/ingv-catalog.js';
import {catalog as demoCatalog} from '../../catalogs/demoCatalog.js';
import {catalog as cesiumCatalog} from '../../catalogs/cesiumCatalog.js';
import {catalog as geoadminCatalog} from '../../catalogs/geoadminCatalog.js';
import type {CesiumWidget} from '@cesium/engine';
import {Resource} from '@cesium/engine';
import {Rectangle} from '@cesium/engine';
import {listTilesInRectangle} from './cesium-utils.js';
import {
  cesiumFetchImageCustom,
  cesiumFetchImageOrig,
  downloadAndPersistImageTiles,
} from '../../utils/cesium-imagery-downloader.js';
import {Task} from '@lit/task';

export type OfflineInfo = {
  appName: string;
  infoFilename: string;
  imagerySubdir: string;
  tiles3dSubdir: string;
  view?: IngvCesiumContext['views'][number];
};

const catalogs: INGVCatalog[] = [demoCatalog, cesiumCatalog, geoadminCatalog];

@customElement('ngv-plugin-cesium-offline')
export class NgvPluginCesiumOffline extends LitElement {
  @property({type: Object})
  viewer: CesiumWidget;
  @property({type: Object})
  info: OfflineInfo;
  @state()
  offline: boolean = false;

  static styles = css`
    button {
      border-radius: 4px;
      padding: 0 16px;
      height: 40px;
      cursor: pointer;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      transition: background-color 200ms;
      width: 100%;
    }
  `;

  // @ts-expect-error TS6133
  private _changeModeTask = new Task(this, {
    args: (): [boolean] => [this.offline],
    task: ([offline]) => {
      if (offline) {
        Resource.prototype.fetch = cesiumFetchCustom([
          this.info.appName,
          this.info.tiles3dSubdir,
        ]);
        Resource.prototype.fetchImage = cesiumFetchImageCustom([
          this.info.appName,
          this.info.imagerySubdir,
        ]);
      } else {
        Resource.prototype.fetch = cesiumFetchOrig;
        Resource.prototype.fetchImage = cesiumFetchImageOrig;
      }
    },
  });

  connectedCallback(): void {
    getOrCreateDirectoryChain([this.info.appName])
      .then(async (dir) => {
        const info: OfflineInfo = await getJson(
          dir,
          `${this.info.infoFilename}.json`,
        );
        if (info) {
          this.offline = true;
          this.dispatchEvent(
            new CustomEvent<OfflineInfo>('offlineInfo', {detail: info}),
          );
        } else {
          this.offline = false;
        }
      })
      .catch(() => {
        this.offline = false;
      });
    super.connectedCallback();
  }

  async switchOffline(): Promise<void> {
    if (!this.info?.appName) {
      throw new Error('App name is required for offline usage');
    }
    this.offline = !this.offline;
    const dir = await getOrCreateDirectoryChain([this.info.appName]);
    if (this.offline) {
      if (this.info.view?.offline?.rectangle?.length) {
        await this.downloadImageries();
      }

      if (this.info.view?.offline.tiles3d?.length) {
        await this.downloadTiles();
      }
      await persistJson(dir, `${this.info.infoFilename}.json`, this.info);
    } else {
      await this.removeLayers();
      // todo remove dir when synced with API
      await removeFile(dir, `${this.info.infoFilename}.json`);
    }
    this.dispatchEvent(
      new CustomEvent('switch', {detail: {offline: this.offline}}),
    );
  }

  async downloadImageries(): Promise<void> {
    if (!this.info.view?.offline?.rectangle) return;
    for (let i = 0; i < this.viewer.imageryLayers.length; i++) {
      const provider = this.viewer.imageryLayers.get(i)?.imageryProvider;
      if (provider) {
        const rectangle = Rectangle.fromDegrees(
          ...this.info.view.offline.rectangle,
        );
        const tiles = listTilesInRectangle(
          rectangle,
          provider,
          this.info.view.offline.imageryMaxLevel,
        );

        await downloadAndPersistImageTiles({
          appName: this.info.appName,
          subdir: this.info.imagerySubdir,
          concurrency: 3,
          imageryProvider: provider,
          tiles: tiles,
        });
      }
    }
  }

  async downloadTiles(): Promise<void> {
    await Promise.all(
      this.info.view.offline.tiles3d.map(async (layer) => {
        const splitted = layer.split('/');
        const id = splitted[0];
        const tilesetName = splitted[1];
        const catalog = catalogs.find((c) => c.id === id);
        if (catalog?.layers[tilesetName]?.type === '3dtiles') {
          await downloadAndPersistTileset({
            appName: this.info.appName,
            subdir: this.info.tiles3dSubdir,
            concurrency: 3,
            tilesetBasePath: (<string>catalog.layers[tilesetName].url).replace(
              'tileset.json',
              '',
            ),
            tilesetName,
          });
        }
      }),
    );
  }

  async removeLayers(): Promise<void> {
    const dir = await getOrCreateDirectoryChain([this.info.appName]);
    await removeDirectory(dir, this.info.tiles3dSubdir);
    await removeDirectory(dir, this.info.imagerySubdir);
  }

  protected render(): unknown {
    return html` <div>
      <button @click=${() => this.switchOffline()}>
        ${this.offline ? msg('Back online') : msg('Go offline')}
      </button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-offline': NgvPluginCesiumOffline;
  }
}
