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
import type {CesiumWidget} from '@cesium/engine';
import {Resource, Math as CMath, Rectangle} from '@cesium/engine';
import {
  getIonAssetToken,
  getLayerConfig,
  listTilesInRectangle,
} from './cesium-utils.js';
import {
  cesiumFetchImageCustom,
  cesiumFetchImageOrig,
  downloadAndPersistImageTiles,
} from '../../utils/cesium-imagery-downloader.js';
import {Task} from '@lit/task';
import {classMap} from 'lit/directives/class-map.js';

export type OfflineInfo = {
  appName: string;
  infoFilename: string;
  imagerySubdir: string;
  tiles3dSubdir: string;
  view?: IngvCesiumContext['views'][number];
};

@customElement('ngv-plugin-cesium-offline')
export class NgvPluginCesiumOffline extends LitElement {
  @property({type: Object})
  viewer: CesiumWidget;
  @property({type: String})
  public ionAssetUrl: string;
  @property({type: String})
  public cesiumApiUrl: string;
  @property({type: Object})
  info: OfflineInfo;
  @state()
  offline: boolean = false;
  @state()
  loading: boolean = false;

  static styles = css`
    div {
      border-radius: 4px;
      padding: 10px;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      display: flex;
      column-gap: 10px;
    }

    div span {
      display: flex;
      align-items: center;
      user-select: none;
    }

    button {
      border-radius: 4px;
      padding: 10px;
      cursor: pointer;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      transition: background-color 200ms;
      align-items: center;
      justify-content: center;
      background-color: lightgreen;
    }

    button.offline {
      background-color: lightcoral;
    }

    .loading {
      margin-left: 10px;
      -webkit-animation: spin 4s linear infinite;
      -moz-animation: spin 4s linear infinite;
      animation: spin 4s linear infinite;
    }
    @-moz-keyframes spin {
      100% {
        -moz-transform: rotate(360deg);
      }
    }
    @-webkit-keyframes spin {
      100% {
        -webkit-transform: rotate(360deg);
      }
    }
    @keyframes spin {
      100% {
        -webkit-transform: rotate(360deg);
        transform: rotate(360deg);
      }
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
    if (this.loading) return;
    if (!this.info?.appName) {
      throw new Error('App name is required for offline usage');
    }
    this.loading = true;
    const offline = !this.offline;
    const dir = await getOrCreateDirectoryChain([this.info.appName]);
    if (offline) {
      if (this.info.view?.offline?.rectangle?.length) {
        await this.downloadImageries();
      }

      if (this.info.view?.tiles3d?.length) {
        await this.downloadTiles();
      }
      await persistJson(dir, `${this.info.infoFilename}.json`, this.info);
      this.offline = offline;
    } else {
      await this.removeLayers();

      // todo remove dir when synced with API
      await removeFile(dir, `${this.info.infoFilename}.json`);
    }
    this.offline = offline;
    this.dispatchEvent(
      new CustomEvent('switch', {detail: {offline: this.offline}}),
    );
    this.loading = false;
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
      this.info.view.tiles3d.map(async (layer) => {
        const config = getLayerConfig(layer);
        if (config?.type === '3dtiles') {
          const splitted = layer.split('/');
          const tilesetName = splitted[1];
          let accessToken: string | undefined;
          try {
            let url = config.url;
            if (typeof url === 'number') {
              const id = url;
              url = `${this.ionAssetUrl}${id}/`;
              accessToken = await getIonAssetToken(id, this.cesiumApiUrl);
            }
            await downloadAndPersistTileset({
              appName: this.info.appName,
              subdir: this.info.tiles3dSubdir,
              concurrency: 3,
              tilesetBasePath: url.replace('tileset.json', ''),
              tilesetName,
              extent: this.info.view.offline.rectangle?.length
                ? this.info.view.offline.rectangle.map(CMath.toRadians)
                : undefined,
              accessToken,
            });
          } catch (e) {
            console.error(`Not possible to save tileset ${layer}:`, e);
          }
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
      ${this.loading
        ? html`<span>${msg('Loading')} <span class="loading">⌛</span></span>`
        : html`<span>
            ${this.offline ? msg('Offline') : msg('Online')}
            ${this.offline ? '🔴' : '🟢'}</span
          >`}

      <button
        .disabled="${this.loading}"
        class="${classMap({offline: !this.offline})}"
        @click=${() => this.switchOffline()}
      >
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
