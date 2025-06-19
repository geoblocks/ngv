import {customElement, property, state} from 'lit/decorators.js';
import {html, type HTMLTemplateResult, LitElement} from 'lit';
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
  @property({type: Object})
  beforeSwitchDispatch: (goOffline: boolean) => Promise<void>;

  @state()
  offline: boolean = false;
  @state()
  loading: boolean = false;

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

    if (this.beforeSwitchDispatch) {
      try {
        await this.beforeSwitchDispatch(offline);
      } catch (error) {
        console.error(error);
        this.loading = false;
        return;
      }
    }
    const dir = await getOrCreateDirectoryChain([this.info.appName]);

    if (offline) {
      if (this.info.view?.offline?.rectangle?.length) {
        await this.downloadImageries();
      }

      if (this.info.view?.tiles3d?.length) {
        await this.downloadTiles();
      }
      await persistJson(dir, `${this.info.infoFilename}.json`, this.info);
      this.offline = true;
    } else {
      await this.removePersistedLayers();

      // todo remove dir when synced with API
      await removeFile(dir, `${this.info.infoFilename}.json`);
    }
    this.offline = offline;
    localStorage.setItem(`${this.info.appName}_offline`, offline.toString());

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

  private async removePersistedLayers(): Promise<void> {
    const dir = await getOrCreateDirectoryChain([this.info.appName]);
    try {
      await removeDirectory(dir, this.info.tiles3dSubdir);
    } catch (error) {
      console.error(error);
    }
    try {
      await removeDirectory(dir, this.info.imagerySubdir);
    } catch (error) {
      console.error(error);
    }
  }

  protected render(): HTMLTemplateResult {
    return html` <wa-card>
      ${this.loading
        ? html`<span>${msg('Loading')} <span class="loading">⌛</span></span>`
        : html`<span>
            ${this.offline ? msg('Offline') : msg('Online')}
            ${this.offline ? '🔴' : '🟢'}</span
          >`}

      <wa-button
        appearance="filled"
        .disabled="${this.loading}"
        class="${classMap({offline: !this.offline})}"
        @click=${() => this.switchOffline()}
      >
        ${this.offline ? msg('Back online') : msg('Go offline')}
      </wa-button>
    </wa-card>`;
  }

  createRenderRoot(): this {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-offline': NgvPluginCesiumOffline;
  }
}
