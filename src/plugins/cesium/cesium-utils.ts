import {type ImageryProvider, Rectangle} from '@cesium/engine';
import {extentToTileRange} from '../../utils/cesium-imagery-downloader.js';

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
