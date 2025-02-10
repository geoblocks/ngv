import {type ImageryProvider, Ion, Rectangle} from '@cesium/engine';
import {extentToTileRange} from '../../utils/cesium-imagery-downloader.js';
import {CESIUM_ASSETS_ENDPOINT} from '../../catalogs/cesiumCatalog.js';

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

export async function getIonAssetToken(id: number): Promise<string> {
  try {
    const endpoint = await fetch(
      CESIUM_ASSETS_ENDPOINT.replace('{id}', id.toString()),
      {headers: {Authorization: `Bearer ${Ion.defaultAccessToken}`}},
    );
    const json = <{accessToken: string}>await endpoint.json();
    return json.accessToken;
  } catch {
    return undefined;
  }
}
