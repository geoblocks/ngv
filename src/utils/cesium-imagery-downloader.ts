import type {ImageryProvider} from '@cesium/engine';
import {Resource, type Cartographic, type TilingScheme} from '@cesium/engine';
import {poolRunner} from './pool-runner.js';
import {
  filenamize,
  getDirectoryIfExists,
  getFileHandle,
  getOrCreateDirectoryChain,
  streamToFile,
} from './storage-utils.js';

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

export const cesiumFetchImageOrig: (options?: {
  preferBlob?: boolean;
  preferImageBitmap?: boolean;
  flipY?: boolean;
  skipColorSpaceConversion?: boolean;
}) => Promise<ImageBitmap | HTMLImageElement> | undefined =
  // eslint-disable-next-line @typescript-eslint/unbound-method
  Resource.prototype.fetchImage;

export const cesiumFetchImageCustom = (directories: string[]) => {
  return async function (options?: {
    preferBlob?: boolean;
    preferImageBitmap?: boolean;
    flipY?: boolean;
    skipColorSpaceConversion?: boolean;
  }): Promise<ImageBitmap | HTMLImageElement> | undefined {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
    const u = new URL(this.url);
    const path = u.pathname.replace('/', '').split('/');
    const name = path.splice(path.length - 1, 1)[0];
    const dir = await getDirectoryIfExists([
      ...directories,
      filenamize(u.hostname),
      ...path,
    ]);
    if (dir) {
      const fileHandler = await getFileHandle(dir, name);
      if (fileHandler) {
        const file = await fileHandler.getFile();
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer]);
        /* @ts-expect-error function is private */
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
        return Resource.createImageBitmapFromBlob(blob, {
          flipY: !!options.flipY,
          skipColorSpaceConversion: !!options.skipColorSpaceConversion,
          premultiplyAlpha: false,
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return cesiumFetchImageOrig.call(this, options);
  };
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
  appName: string;
  subdir: string;
  concurrency: number;
  imageryProvider: ImageryProvider;
  tiles: number[][];
}): Promise<void> {
  const {appName, subdir, concurrency, imageryProvider, tiles} = options;
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const url = (<Resource>imageryProvider._resource).url;
      const u = new URL(url);
      const path = decodeURI(u.pathname).replace('/', '').split('/');
      path[path.length - 3] = path[path.length - 3].replace(
        /{\w*}/g,
        z.toString(),
      );
      path[path.length - 2] = path[path.length - 2].replace(
        /{\w*}/g,
        x.toString(),
      );
      path[path.length - 1] = path[path.length - 1].replace(
        /{\w*}/g,
        y.toString(),
      );
      const name = path.splice(path.length - 1, 1)[0];

      const dir = await getOrCreateDirectoryChain([
        appName,
        subdir,
        filenamize(u.hostname),
        ...path,
      ]);
      return streamToFile(dir, name, blob.stream()).catch((error) => {
        controller.abort(error);
      });
    },
  });
}
