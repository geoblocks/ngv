import {ImageryTypes, Proxy, Request} from '@cesium/engine';
import {
  Resource,
  type Cartographic,
  ImageryProvider,
  type TilingScheme,
} from '@cesium/engine';
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

const fetchImageOrig: (options?: {
  preferBlob?: boolean;
  preferImageBitmap?: boolean;
  flipY?: boolean;
  skipColorSpaceConversion?: boolean;
}) => Promise<ImageBitmap | HTMLImageElement> | undefined =
  Resource.prototype.fetchImage;

Resource.prototype.fetchImage = async function (
  options,
): Promise<ImageBitmap | HTMLImageElement> | undefined {
  // console.log(this.url, options);

  const u = new URL(this.url);
  const path = u.pathname.replace('/', '').split('/');
  const name = path.splice(path.length - 1, 1)[0];
  const ext = name.split('.')[1];
  //todo add layer name dir
  const dir = await getDirectoryIfExists([
    'survey',
    'imageries',
    filenamize(u.hostname),
    ...path,
  ]);
  if (dir) {
    const fileHandler = await getFileHandle(dir, name);
    if (fileHandler) {
      const file = await fileHandler.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: `image/${ext.toLowerCase()}`,
      });
      return Resource.createImageBitmapFromBlob(blob, {
        flipY: !!options.flipY,
        skipColorSpaceConversion: !!options.skipColorSpaceConversion,
        premultiplyAlpha: false,
      });
    }
  }

  return fetchImageOrig.call(this, options);
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
  prefix: string;
  concurrency: number;
  imageryProvider: ImageryProvider;
  tiles: number[][];
}): Promise<void> {
  const {appName, subdir, concurrency, imageryProvider, prefix, tiles} =
    options;
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
      //todo improve
      const url = (<Resource>imageryProvider._resource).url;
      const u = new URL(url);
      const path = decodeURI(u.pathname)
        .replace('{x}', x.toString())
        .replace('{y}', y.toString())
        .replace('{z}', z.toString())
        .replace('/', '')
        .split('/');
      const name = path.splice(path.length - 1, 1)[0];
      //todo add layer name dir
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
