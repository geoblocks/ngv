// FIXME: This file is just for local testing
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable  @typescript-eslint/no-unsafe-member-access */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  downloadAndPersistTileset,
  listTilesetUrls,
} from './cesium-tileset-downloader.js';

await test(async function testList3dTilesetFunction() {
  const controller = new AbortController();
  const urls = await listTilesetUrls(
    // 'https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/'
    'http://localhost:8000/',
    {
      content: {
        uri: 'tileset.json',
      },
    },
    {
      foundUrls: [],
      signal: controller.signal,
      // extent: [6.559494, 46.515362, 6.578460, 46.524816].map(d => Math.PI * d / 180)
    },
  );
  console.log(urls);
  assert(urls.length > 100 && urls.length < 1000, 'Incorrect');
});

await test.only(async function testDownloadAndPersistTileset() {
  await downloadAndPersistTileset({
    appName: 'test',
    concurrency: 3,
    tilesetBasePath: 'http://localhost:8000/',
    tilesetName: 'clip-test',
  });
});
