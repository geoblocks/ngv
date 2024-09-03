import {
  Ion,
  Math as CesiumMath,
  CesiumWidget,
  Cartesian3,
} from '@cesium/engine';

import {
  INGVCesium3DTiles,
  INGVCesiumAllTypes,
  INGVCesiumImageryTypes,
  INGVCesiumTerrain,
} from 'src/interfaces/ingv-layers.js';
import {
  Cesium3DTileset,
  CesiumTerrainProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from '@cesium/engine';
import {IngvCesiumContext} from 'src/interfaces/ingv-cesium-context.js';
import {INGVCatalog} from 'src/interfaces/ingv-catalog.js';

export async function instantiateTerrain(
  config: INGVCesiumTerrain,
): Promise<CesiumTerrainProvider> {
  const url = config.url;
  if (typeof url === 'string') {
    return CesiumTerrainProvider.fromUrl(url, config.options);
  } else {
    return CesiumTerrainProvider.fromIonAssetId(url, config.options);
  }
}

export async function instantiate3dTileset(config: INGVCesium3DTiles) {
  const url = config.url;
  if (typeof url === 'string') {
    return Cesium3DTileset.fromUrl(url, config.options);
  } else {
    return Cesium3DTileset.fromIonAssetId(url, config.options);
  }
}

export function instantiateImageryProvider(config: INGVCesiumImageryTypes) {
  switch (config.type) {
    case 'urltemplate':
      return new UrlTemplateImageryProvider(config.options);
    case 'wms':
      return new WebMapServiceImageryProvider(config.options);
    case 'wmts':
      return new WebMapTileServiceImageryProvider(config.options);
  }
}

async function resolveCatalog(
  cesiumContext: IngvCesiumContext,
  catalogName: string,
): Promise<void> {
  const catalog = cesiumContext.catalogs[catalogName];
  if (typeof catalog === 'string') {
    const result = (await fetch(catalog).then((r) => r.json())) as INGVCatalog;
    if (!result.id || !result.layers) {
      return Promise.reject(
        new Error(`Catalog ${catalogName} looks incorrect`),
      );
    }
    cesiumContext.catalogs[catalogName] = result;
  } else if (typeof catalog === 'function') {
    const result = await catalog();
    cesiumContext.catalogs[catalogName] = result.catalog;
  }
}

export function isTerrainConfig(
  config: INGVCesiumAllTypes,
): config is INGVCesiumTerrain {
  return config?.type === 'terrain';
}

export function is3dTilesetConfig(
  config: INGVCesiumAllTypes,
): config is INGVCesium3DTiles {
  return config?.type === '3dtiles';
}

export function isImageryConfig(
  config: INGVCesiumAllTypes,
): config is INGVCesiumImageryTypes {
  return ['wms', 'wmts', 'urltemplate'].includes(config?.type);
}

async function resolveLayers(
  cesiumContext: IngvCesiumContext,
  keys: string[],
): Promise<Record<string, INGVCesiumAllTypes>> {
  const catalogKeys = keys.map((k) => k.split('/')[0]);
  const uniqueCatalogKeys = new Set(catalogKeys);
  for (const catalogName of uniqueCatalogKeys) {
    await resolveCatalog(cesiumContext, catalogName);
  }

  const resolvedLayers = keys.reduce(
    (results: Record<string, INGVCesiumAllTypes>, k: string) => {
      // FIXME: we could say that catalogs should always start with an @
      // and avoid having to remove that first character?
      const [catalogName, layerName] = k.split('/', 2);
      const catalog = cesiumContext.catalogs[catalogName] as INGVCatalog; // we resolved it before
      const config = catalog.layers[layerName];
      if (!config) {
        throw new Error(
          `The ${layerName} can not be found in ${catalogName} catalog`,
        );
      }
      results[k] = config;
      return results;
    },
    {},
  );
  return resolvedLayers;
}

export async function initCesiumWidget(
  container: HTMLDivElement,
  cesiumContext: IngvCesiumContext,
): Promise<CesiumWidget> {
  window.CESIUM_BASE_URL = cesiumContext.baseUrl || '/';

  if (cesiumContext.cesiumApiKey) {
    Ion.defaultAccessToken = cesiumContext.cesiumApiKey;
  }

  // Retrieve catalogs
  for (const catalogName in cesiumContext.catalogs) {
    await resolveCatalog(cesiumContext, catalogName);
  }

  // Resolve active layers
  const resolvedLayers = await resolveLayers(
    cesiumContext,
    (function () {
      const l = cesiumContext.layers;
      const keys: string[] = [];
      if (l?.imageries) {
        keys.push(...l.imageries);
      }
      if (l.terrain) {
        keys.push(l.terrain);
      }
      if (l.tiles3d) {
        keys.push(...l.tiles3d);
      }
      return keys;
    })(),
  );

  const viewer = new CesiumWidget(
    container,
    Object.assign({}, cesiumContext.widgetOptions),
  );

  const stuffToDo: Promise<void>[] = [];
  if (cesiumContext.layers.terrain) {
    const config = resolvedLayers[cesiumContext.layers.terrain];
    if (!isTerrainConfig(config)) {
      throw new Error();
    }
    stuffToDo.push(
      instantiateTerrain(config).then((terrainProvider) => {
        viewer.scene.terrainProvider = terrainProvider;
      }),
    );
  }

  cesiumContext.layers.tiles3d?.forEach((name) => {
    const config = resolvedLayers[name];
    if (!is3dTilesetConfig(config)) {
      throw new Error();
    }
    stuffToDo.push(
      instantiate3dTileset(config).then((tileset) => {
        viewer.scene.primitives.add(tileset);
      }),
    );
  });

  cesiumContext.layers.imageries.map((name) => {
    const config = resolvedLayers[name];
    if (!isImageryConfig(config)) {
      throw new Error();
    }
    const provider = instantiateImageryProvider(config);
    viewer.scene.imageryLayers.addImageryProvider(provider);
  });

  // FIXME: we should probably displatch an event
  // return Promise.all(stuffToDo);

  const cameraConfig = cesiumContext.camera;
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(...cameraConfig.position),
    orientation: {
      heading: CesiumMath.toRadians(cameraConfig.orientation.heading),
      pitch: CesiumMath.toRadians(cameraConfig.orientation.pitch),
    },
    duration: 0,
  });

  return viewer;
}
