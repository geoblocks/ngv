import {poolRunner} from './pool-runner.js';
import {
  streamToFile,
  getOrCreateDirectoryChain,
  getDirectoryIfExists,
  getFileHandle,
  getPathAndNameFromUrl,
} from './storage-utils.js';
import {Resource} from '@cesium/engine';

interface TilesetNode {
  content?: {
    uri: string;
  };
  children?: TilesetNode[];
  geometricError?: number;
  refine?: 'ADD' | 'REPLACE';
  boundingVolume?: {
    /**
     * [west, south, east, north, minimum height, maximum height]
     * The boundingVolume.region property is an array of six numbers that define the bounding geographic region with latitude,
     * longitude, and height coordinates with the order [west, south, east, north, minimum height, maximum height].
     * Latitudes and longitudes are in the WGS 84 datum as defined in EPSG 4979 and are in radians. Heights are in meters above (or below)
     * the WGS 84 ellipsoid.
     */
    region: [number, number, number, number, number, number];
  };
}

interface Tileset {
  root: TilesetNode;
}

interface ListTilesetOptions {
  signal: AbortSignal;
  foundUrls: string[];
  /**
   * [west, south, east, north] in radians
   */
  extent?: number[];
}

// eslint-disable-next-line @typescript-eslint/unbound-method
export const cesiumFetchOrig = Resource.prototype.fetch;

export function cesiumFetchCustom(directories: string[]) {
  return async function (options?: {
    responseType?: string;
    headers?: any;
    overrideMimeType?: string;
  }): Promise<any> {
    if (
      options?.responseType === 'arraybuffer' ||
      (options?.responseType === 'text' &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
        options?.headers.Accept.includes('application/json'))
    ) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
      const {path, name} = getPathAndNameFromUrl(this.url);
      console.log(path, name);
      const dir = await getDirectoryIfExists([...directories, ...path]);
      if (dir) {
        const fileHandler = await getFileHandle(dir, name);
        const file = await fileHandler.getFile();
        if (file) {
          return options.responseType === 'arraybuffer'
            ? file.arrayBuffer()
            : file.text();
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return cesiumFetchOrig.call(this, options);
  };
}

function rectsOverlapping(rect1: number[], rect2: number[], error: number) {
  return !(
    rect1[2] + error < rect2[0] ||
    rect1[0] - error > rect2[2] ||
    rect1[3] + error < rect2[1] ||
    rect1[1] - error > rect2[3]
  );
}

// Nonsensical computation
const rads_per_meter = ((2 * Math.PI) / 40_000_000) * 200;

export async function listTilesetUrls(
  basePath: string,
  node: TilesetNode,
  options: ListTilesetOptions,
): Promise<string[]> {
  const {signal, foundUrls} = options;
  if (node.boundingVolume?.region && options.extent) {
    if (
      !rectsOverlapping(
        node.boundingVolume.region,
        options.extent,
        node.geometricError * rads_per_meter,
      )
    ) {
      return options.foundUrls;
    }
  }
  if (node.content) {
    const content = <{uri?: string; url?: string}>node.content;
    const contentUri = content.uri || content.url;
    console.assert(contentUri, 'No URI in this node content');
    const uri = basePath + contentUri;
    if (uri.endsWith('.json')) {
      // this is a sub-tileset
      console.log('Fetching', uri);
      const ts = (await (
        await fetch(uri, {
          signal: signal,
        })
      ).json()) as Tileset;
      const truncatedUri = uri
        .split('/')
        .filter((_, idx, arr) => idx < arr.length - 1)
        .join('/');
      await listTilesetUrls(truncatedUri + '/', ts.root, options);
    }
    // We add all uris in the list, including .json ones
    foundUrls.push(uri);
  }
  if (node.children) {
    await Promise.all(
      node.children.map((c) => listTilesetUrls(basePath, c, options)),
    );
  }
  return options.foundUrls;
}

export async function downloadAndPersistTileset(options: {
  appName: string;
  subdir: string;
  tilesetBasePath: string;
  tilesetFilename?: string;
  tilesetName: string;
  concurrency: number;
  extent?: number[];
}): Promise<void> {
  const {
    appName,
    subdir,
    tilesetFilename,
    tilesetBasePath,
    concurrency,
    extent,
  } = options;
  const controller = new AbortController();
  const allUrls = await listTilesetUrls(
    tilesetBasePath,
    {
      content: {
        uri: tilesetFilename ?? 'tileset.json',
      },
    },
    {
      signal: controller.signal,
      foundUrls: [],
      extent,
    },
  );

  return await poolRunner({
    concurrency: concurrency,
    tasks: allUrls,
    async runTask(url) {
      const response = await fetch(url, {
        signal: controller.signal,
      });
      const {path, name} = getPathAndNameFromUrl(url);
      const dir = await getOrCreateDirectoryChain([appName, subdir, ...path]);
      return streamToFile(dir, name, response.body).catch((error) => {
        controller.abort(error);
      });
    },
  });
}
