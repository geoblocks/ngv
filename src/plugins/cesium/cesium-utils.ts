import {
  Cesium3DTileset,
  type ImageryProvider,
  Ion,
  Rectangle,
  Resource,
} from '@cesium/engine';
import {extentToTileRange} from '../../utils/cesium-imagery-downloader.js';
import {catalog as cesiumCatalog} from '../../catalogs/cesiumCatalog.js';
import {catalog as demoCatalog} from '../../catalogs/demoCatalog.js';
import {catalog as geoadminCatalog} from '../../catalogs/geoadminCatalog.js';
import type {INGVCatalog} from '../../interfaces/cesium/ingv-catalog.js';
import type {INGVCesiumAllTypes} from '../../interfaces/cesium/ingv-layers.js';

const catalogs: INGVCatalog[] = [demoCatalog, cesiumCatalog, geoadminCatalog];

export function listTilesInRectangle(
  rectangle: Rectangle,
  imageryProvider: ImageryProvider,
  maximumLevel: number = 16,
): number[][] {
  const southwest = Rectangle.southwest(rectangle);
  const northeast = Rectangle.northeast(rectangle);
  const allTiles = new Array(1 + maximumLevel - imageryProvider.minimumLevel)
    .fill(0)
    .map((_v, index) => {
      return extentToTileRange({
        level: index + imageryProvider.minimumLevel,
        southWestCarto: southwest,
        northEastCarto: northeast,
        tilingScheme: imageryProvider.tilingScheme,
      });
    });
  return allTiles.flat();
}

export async function getIonAssetToken(
  id: number,
  cesiumApiUrl: string,
): Promise<string> {
  try {
    const endpoint = await fetch(
      `${cesiumApiUrl}v1/assets/${id.toString()}/endpoint`,
      {headers: {Authorization: `Bearer ${Ion.defaultAccessToken}`}},
    );
    const json = <{accessToken: string}>await endpoint.json();
    return json.accessToken;
  } catch {
    return undefined;
  }
}

export function getLayerConfig(catalogName: string): INGVCesiumAllTypes {
  const splitted = catalogName.split('/');
  const id = splitted[0];
  const tilesetName = splitted[1];
  const catalog = catalogs.find((c) => c.id === id);
  return catalog.layers[tilesetName];
}

export async function getTilesetForOffline(options: {
  catalogName: string;
  extraOptions?: Record<string, Record<string, any>>;
  ionAssetUrl?: string;
  cesiumApiUrl?: string;
}): Promise<Cesium3DTileset> {
  const {catalogName, extraOptions, ionAssetUrl, cesiumApiUrl} = options;
  const config = getLayerConfig(catalogName);
  if (!config?.type || config?.type !== '3dtiles') {
    return undefined;
  }
  const urlOrId = config.url;
  // Replaces Cesium ION id with cesium API url to make it work offline
  let accessToken: string | undefined;
  let id: number | undefined;
  let url: string;
  if (typeof urlOrId === 'number') {
    try {
      id = urlOrId;
      accessToken = await getIonAssetToken(urlOrId, cesiumApiUrl);
      url = `${ionAssetUrl}${urlOrId}/tileset.json`;
    } catch (e) {
      console.error(e);
    }
  } else {
    url = urlOrId;
  }
  const resource = new Resource({
    url,
    headers: accessToken ? {Authorization: `Bearer ${accessToken}`} : {},
    retryCallback: id
      ? async (resource, error) => {
          if (error.statusCode === 403 || error.statusCode === 401) {
            try {
              accessToken = await getIonAssetToken(id, cesiumApiUrl);
              resource.headers = {
                Authorization: `Bearer ${accessToken}`,
              };
              return true;
            } catch {
              return false;
            }
          }
          return false;
        }
      : undefined,
  });
  return Cesium3DTileset.fromUrl(
    // This allows for offline mode
    resource,
    withExtra(config.options, extraOptions),
  );
}

export function withExtra<T>(options: T, extra: Record<string, any>): T {
  if (!extra) {
    return options;
  }
  return Object.assign({}, options, extra) as T;
}
