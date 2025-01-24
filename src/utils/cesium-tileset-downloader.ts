import {poolRunner} from './pool-runner.js';
import {
  getOrCreateDirectoryChain,
  streamToFile,
  filenamize,
} from './storage-utils.js';

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

function rectsOverlapping(rect1: number[], rect2: number[], error: number) {
  // console.log("Is overlapping", rect1, rect2, error);
  if (rect1[2] + error < rect2[0] || rect2[2] + error < rect1[0]) {
    return false;
  }
  if (rect1[1] + error < rect2[3] || rect2[1] + error < rect1[3]) {
    return false;
  }
  return true;
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
    console.assert(node.content.uri, 'No URI in this node content');
    const uri = basePath + node.content.uri;
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
  tilesetBasePath: string;
  tilesetFilename?: string;
  tilesetName: string;
  concurrency: number;
}): Promise<void> {
  const {appName, tilesetFilename, tilesetBasePath, concurrency} = options;
  const persistedDir = await getOrCreateDirectoryChain([appName, 'persisted']);
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
    },
  );

  return await poolRunner({
    concurrency: concurrency,
    tasks: allUrls,
    async runTask(url) {
      const response = await fetch(url, {
        signal: controller.signal,
      });
      const filename = filenamize(url);
      return streamToFile(persistedDir, filename, response.body).catch(
        (error) => {
          controller.abort(error);
        },
      );
    },
  });
}
