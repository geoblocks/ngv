import {
  Resource,
  type Cartographic,
  type ImageryProvider,
  type TilingScheme,
} from '@cesium/engine';
import {poolRunner} from './pool-runner.js';
import {streamToFile} from './storage-utils.js';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const orig: (...blob: [Blob]) => Promise<{
  blob: Blob;
}> =
  /* @ts-expect-error this function is private! */
  Resource.createImageBitmapFromBlob;
/* @ts-expect-error function is private */
Resource.createImageBitmapFromBlob = async function (...args: [Blob]) {
  const res = await orig(...args);
  res.blob = args[0];
  /* eslint-disable-nextline @typescript-eslint/no-unsafe-return */
  return res;
};

interface ExtentToTileRangeOptions {
  southWestCarto: Cartographic;
  northEastCarto: Cartographic;
  level: number;
  tilingScheme: TilingScheme;
}
export function extentToTileRange(
  options: ExtentToTileRangeOptions,
): number[][] {
  const {tilingScheme, level, southWestCarto, northEastCarto} = options;
  const minXY = tilingScheme.positionToTileXY(southWestCarto, level);
  const maxXY = tilingScheme.positionToTileXY(northEastCarto, level);
  const count = (1 + minXY.y - maxXY.y) * (1 + maxXY.x - minXY.x);
  console.assert(count > 0);
  const range: number[][] = new Array(count) as number[][];
  let i = 0;
  for (let x = minXY.x; x <= maxXY.x; ++x) {
    for (let y = maxXY.y; y <= minXY.y; ++y) {
      range[i] = [level, x, y];
      ++i;
    }
  }
  return range;
}

export async function downloadAndPersistImageTiles(options: {
  persistedDir: FileSystemDirectoryHandle;
  prefix: string;
  concurrency: number;
  imageryProvider: ImageryProvider;
  tiles: number[][];
}): Promise<void> {
  const {persistedDir, concurrency, imageryProvider, prefix, tiles} = options;
  const controller = new AbortController();

  return await poolRunner({
    concurrency: concurrency,
    tasks: tiles,
    signal: controller.signal,
    async runTask(tile: number[]) {
      const [z, x, y] = tile;
      const data = await imageryProvider.requestImage(x, y, z);
      // CesiumJS stores the fetched blob in the non-standard blob property
      if (data instanceof HTMLImageElement) {
        const error = new Error(
          `The image for tile ${tile.toString()} is of type HTMLImageElement`,
        );
        controller.abort(error);
        throw error;
      }
      if (data instanceof HTMLCanvasElement) {
        const error = new Error(
          `The image for tile ${tile.toString()} is of type HTMLCanvasElement`,
        );
        controller.abort(error);
        throw error;
      }
      // eslint-disable @typescript-eslint/no-unsafe-assignment
      // @ts-expect-error blob property does not exist
      const blob: Blob = data.blob as Blob;
      if (!blob) {
        const error = new Error(
          `The image for tile ${tile.toString()} has no blob`,
          {
            cause: blob,
          },
        );
        controller.abort(error);
        throw error;
      }
      // FIXME: how to choose the suffix (jpg / png / ...)
      const filename = `zxy_${prefix}_${z}_${x}_${y}`;
      console.log(filename);
      return streamToFile(persistedDir, filename, blob.stream()).catch(
        (error) => {
          controller.abort(error);
        },
      );
    },
  });
}
