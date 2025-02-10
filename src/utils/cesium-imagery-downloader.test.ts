// FIXME: This file is just for local testing

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {downloadAndPersistImageTiles} from './cesium-imagery-downloader.js';
import {Rectangle, UrlTemplateImageryProvider} from '@cesium/engine';

import 'opfs-mock';
import {listTilesInRectangle} from '../plugins/cesium/cesium-utils.js';
import {listDirectoryContents} from './debug-utils.js';

import './mocks.test.js';

await test.only(async function testDownloadAndPersistImagery() {
  const imageryProvider = new UrlTemplateImageryProvider({
    url: 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}',
    customTags: {
      layer() {
        return 'ch.swisstopo.swissimage';
      },
      timestamp() {
        return 'current';
      },
      format() {
        return 'jpeg';
      },
    },
    maximumLevel: 16,
  });

  const rectangle = Rectangle.fromDegrees(
    // EPFL, check that in map.geoadmin.ch
    6.559494,
    46.515362,
    6.57846,
    46.524816,
  );
  const tiles = listTilesInRectangle(rectangle, imageryProvider);

  assert(tiles.length === 32, 'Incorrect number of tiles ' + tiles.length);
  await downloadAndPersistImageTiles({
    appName: 'test',
    subdir: 'persisted',
    concurrency: 3,
    imageryProvider,
    tiles: tiles,
  });
  await listDirectoryContents(await navigator.storage.getDirectory(), 5);
});
