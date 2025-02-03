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
import {downloadAndPersistTileset} from '../../utils/cesium-tileset-downloader.js';
import {listDirectoryContents} from '../../utils/debug-utils.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import type {INGVCatalog} from '../../interfaces/cesium/ingv-catalog.js';
import {catalog as demoCatalog} from '../../catalogs/demoCatalog.js';
import {catalog as cesiumCatalog} from '../../catalogs/cesiumCatalog.js';
import {catalog as geoadminCatalog} from '../../catalogs/geoadminCatalog.js';
import type {CesiumWidget} from '@cesium/engine';
import {Rectangle} from '@cesium/engine';
import {listTilesInRectangle} from './cesium-utils.js';
import {downloadAndPersistImageTiles} from '../../utils/cesium-imagery-downloader.js';

export type OfflineInfo = {
  appName: string;
  view?: IngvCesiumContext['views'][number];
};

const OFFLINE_INFO_FILENAME = 'offline-info.json';
const TILES_SUBDIR = 'tiles3d';
const IMAGERY_SUBDIR = 'imageries';
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
  connectedCallback(): void {
    getOrCreateDirectoryChain([this.info.appName])
      .then(async (dir) => {
        try {
          const info: OfflineInfo = await getJson(dir, OFFLINE_INFO_FILENAME);
          this.offline = true;
          this.dispatchEvent(
            new CustomEvent<OfflineInfo>('offlineInfo', {detail: info}),
          );
        } catch {
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
      await persistJson(dir, OFFLINE_INFO_FILENAME, this.info);
    } else {
      await this.removeLayers();
      // todo remove dir when synced with API
      await removeFile(dir, OFFLINE_INFO_FILENAME);
    }
    this.dispatchEvent(
      new CustomEvent('switch', {detail: {offline: this.offline}}),
    );
  }

  async downloadImageries(): Promise<void> {
    if (!this.info.view?.offline?.rectangle) return;
    const persistedDir = await getOrCreateDirectoryChain([
      this.info.appName,
      IMAGERY_SUBDIR,
    ]);
    for (let i = 0; i < this.viewer.imageryLayers.length; i++) {
      const provider = this.viewer.imageryLayers.get(i)?.imageryProvider;
      if (provider) {
        const rectangle = Rectangle.fromDegrees(
          ...this.info.view.offline.rectangle,
        );
        // todo add maximumLevel to config
        const tiles = listTilesInRectangle(rectangle, provider);

        const prefix = `imagery-${i}-${Date.now()}`;
        await downloadAndPersistImageTiles({
          persistedDir,
          concurrency: 3,
          imageryProvider: provider,
          prefix,
          tiles: tiles,
        });
        // todo update type in config
        this.info.view.offline.imageries.push(prefix);
      }
    }
    await listDirectoryContents(persistedDir, 10);
    // const imageryProvider = new UrlTemplateImageryProvider({
    //   url: 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}',
    //   customTags: {
    //     layer() {
    //       return 'ch.swisstopo.swissimage';
    //     },
    //     timestamp() {
    //       return 'current';
    //     },
    //     format() {
    //       return 'jpeg';
    //     },
    //   },
    //   maximumLevel: 16,
    // });
  }

  async downloadTiles(): Promise<void> {
    const dir = await getOrCreateDirectoryChain([
      this.info.appName,
      TILES_SUBDIR,
    ]);
    await Promise.all(
      this.info.view.offline.tiles3d.map(async (layer) => {
        const splitted = layer.split('/');
        const id = splitted[0];
        const tilesetName = splitted[1];
        const catalog = catalogs.find((c) => c.id === id);
        if (catalog?.layers[tilesetName]?.type === '3dtiles') {
          await downloadAndPersistTileset({
            persistedDir: dir,
            concurrency: 3,
            tilesetBasePath: (<string>catalog.layers[tilesetName].url).replace(
              'tileset.json',
              '',
            ),
            tilesetName,
          });
          await listDirectoryContents(dir, 10);
        }
      }),
    );
  }

  async removeLayers(): Promise<void> {
    const dir = await getOrCreateDirectoryChain([this.info.appName]);
    await removeDirectory(dir, TILES_SUBDIR);
    await removeDirectory(dir, IMAGERY_SUBDIR);
    await listDirectoryContents(dir, 10);

    // await Promise.all(
    //   this.info.view.offline.tiles3d.map(async (layer) => {
    //     const splitted = layer.split('/');
    //     const id = splitted[0];
    //     const tilesetName = splitted[1];
    //     const catalog = catalogs.find((c) => c.id === id);
    //     if (catalog?.layers[tilesetName]?.type === '3dtiles') {
    //     }
    //   }),
    // );
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
