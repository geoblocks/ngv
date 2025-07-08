import {
  Cartesian3,
  Cartographic,
  Cesium3DTileset,
  CesiumTerrainProvider,
  CesiumWidget,
  DataSourceCollection,
  DataSourceDisplay,
  Ellipsoid,
  HeadingPitchRoll,
  type ImageryProvider,
  Ion,
  Math as CesiumMath,
  Model,
  OpenStreetMapImageryProvider,
  PrimitiveCollection,
  Resource,
  Transforms,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from '@cesium/engine';

import type {
  INGVCesium3DTiles,
  INGVCesiumAllTypes,
  INGVCesiumImageryTypes,
  INGVCesiumModel,
  INGVCesiumModelConfig,
  INGVCesiumTerrain,
  INGVIFC,
} from '../../interfaces/cesium/ingv-layers.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import type {INGVCatalog} from '../../interfaces/cesium/ingv-catalog.js';
import {getClippingPolygon, getDimensions} from './interactionHelpers.js';
import {getTilesetForOffline, withExtra} from './cesium-utils.js';

export async function instantiateTerrain(
  config: INGVCesiumTerrain,
  extraOptions?: Record<string, any>,
): Promise<CesiumTerrainProvider> {
  const url = config.url;
  if (typeof url === 'string') {
    return CesiumTerrainProvider.fromUrl(
      url,
      withExtra(config.options, extraOptions),
    );
  } else {
    return CesiumTerrainProvider.fromIonAssetId(
      url,
      withExtra(config.options, extraOptions),
    );
  }
}

export async function instantiateModel(
  config: INGVCesiumModelConfig,
  extraOptions?: Record<string, any>,
): Promise<INGVCesiumModel> {
  const model: INGVCesiumModel = await Model.fromGltfAsync(
    withExtra(config.options, extraOptions),
  );
  model.readyEvent.addEventListener(() => {
    model.id.dimensions = getDimensions(model);
    model.id.clippingPolygon = getClippingPolygon(model);
  });
  return model;
}

export async function instantiate3dTileset(
  name: string,
  config: INGVCesium3DTiles,
  cesiumContext: IngvCesiumContext,
): Promise<Cesium3DTileset> {
  const extraOptions = cesiumContext.layerOptions[name];
  const url = config.url;
  const subtype = config.subtype;
  if (subtype === 'googlePhotorealistic') {
    // this should be treeshaked, at leat parcel does it
    // https://parceljs.org/features/code-splitting/
    // not 100% sure about vite
    const {createGooglePhotorealistic3DTileset} = await import(
      '@cesium/engine'
    );
    const key = extraOptions?.key as string | undefined;
    return createGooglePhotorealistic3DTileset({key});
  }

  if (cesiumContext.views?.length) {
    return getTilesetForOffline({
      cesiumApiUrl: cesiumContext.cesiumApiUrl,
      ionAssetUrl: cesiumContext.ionAssetUrl,
      extraOptions,
      catalogName: name,
    });
  } else if (typeof url === 'string') {
    return Cesium3DTileset.fromUrl(
      // This allows for offline mode
      new Resource(url),
      withExtra(config.options, extraOptions),
    );
  } else {
    return Cesium3DTileset.fromIonAssetId(
      url,
      withExtra(config.options, extraOptions),
    );
  }
}

export function instantiateImageryProvider(
  config: INGVCesiumImageryTypes,
  extraOptions?: Record<string, any>,
): ImageryProvider {
  switch (config.type) {
    case 'urltemplate':
      if (config.options.customTags) {
        const cts = config.options.customTags as Record<
          string,
          (() => any) | string
        >;
        for (const k in cts) {
          const v = cts[k];
          if (typeof v !== 'function') {
            cts[k] = () => v;
          }
        }
      }
      return new UrlTemplateImageryProvider(
        withExtra(config.options, extraOptions),
      );
    case 'wms':
      return new WebMapServiceImageryProvider(
        withExtra(config.options, extraOptions),
      );
    case 'wmts':
      return new WebMapTileServiceImageryProvider(
        withExtra(config.options, extraOptions),
      );
    case 'openstreetmap':
      return new OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
      });
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

export function isModelConfig(
  config: INGVCesiumAllTypes,
): config is INGVCesiumModelConfig {
  return config?.type === 'model';
}

export function isIFCConfig(config: INGVCesiumAllTypes): config is INGVIFC {
  return config?.type === 'ifc';
}

export function isImageryConfig(
  config: INGVCesiumAllTypes,
): config is INGVCesiumImageryTypes {
  return ['wms', 'wmts', 'urltemplate', 'openstreetmap'].includes(config?.type);
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
      if (!catalog) {
        throw new Error(`The catalog ${catalogName} can not be found`);
      }
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
  modelCallback: (name: string, model: Model) => void,
): Promise<{
  viewer: CesiumWidget;
  dataSourceCollection: DataSourceCollection;
  primitiveCollections: {
    models: PrimitiveCollection;
    tiles3d: PrimitiveCollection;
  };
}> {
  modelCallback =
    modelCallback ||
    (() => {
      console.warn('Missing modelCallback');
    });

  if (cesiumContext.baseUrl) {
    window.CESIUM_BASE_URL = cesiumContext.baseUrl;
  } else {
    window.CESIUM_BASE_URL = window.NGV_BASE_URL;
  }

  if (cesiumContext.ionDefaultAccessToken) {
    Ion.defaultAccessToken = cesiumContext.ionDefaultAccessToken;
  }

  if (!cesiumContext.cesiumApiUrl) {
    cesiumContext.cesiumApiUrl = 'https://api.cesium.com/';
  }

  if (!cesiumContext.ionAssetUrl) {
    cesiumContext.ionAssetUrl = 'https://assets.ion.cesium.com/';
  }

  cesiumContext.layerOptions = cesiumContext.layerOptions || {};

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
      if (l.models) {
        keys.push(...l.models);
      }
      return keys;
    })(),
  );

  const viewer = new CesiumWidget(
    container,
    Object.assign({baseLayer: false}, cesiumContext.widgetOptions),
  );

  if (cesiumContext.globeOptions) {
    Object.assign(viewer.scene.globe, cesiumContext.globeOptions);
  }

  const primitiveCollections = {
    models: new PrimitiveCollection(),
    tiles3d: new PrimitiveCollection(),
  };

  viewer.scene.primitives.add(primitiveCollections.models);
  viewer.scene.primitives.add(primitiveCollections.tiles3d);

  const dataSourceCollection = new DataSourceCollection();
  const dataSourceDisplay = new DataSourceDisplay({
    scene: viewer.scene,
    dataSourceCollection: dataSourceCollection,
  });
  const clock = viewer.clock;
  // todo: check if OK
  clock.onTick.addEventListener(() => {
    dataSourceDisplay.update(clock.currentTime);
  });

  const stuffToDo: Promise<void>[] = [];
  if (cesiumContext.layers.terrain) {
    const name = cesiumContext.layers.terrain;
    const config = resolvedLayers[name];
    if (!isTerrainConfig(config)) {
      throw new Error();
    }
    stuffToDo.push(
      instantiateTerrain(config, cesiumContext.layerOptions[name]).then(
        (terrainProvider) => {
          viewer.scene.terrainProvider = terrainProvider;
        },
      ),
    );
  }

  cesiumContext.layers.tiles3d?.forEach((name) => {
    const config = resolvedLayers[name];
    if (!is3dTilesetConfig(config)) {
      throw new Error();
    }
    stuffToDo.push(
      instantiate3dTileset(name, config, cesiumContext).then((tileset) => {
        primitiveCollections.tiles3d.add(tileset);
      }),
    );
  });

  const modelPromises = cesiumContext.layers.models?.map(async (path) => {
    let config = resolvedLayers[path];
    let toRevokeUrl: string;

    if (isIFCConfig(config)) {
      const ifcUrl = config.url;
      const modelOptions = config.options?.modelOptions;
      const {ifcToGLTF} = await import('@geoblocks/ifc-gltf');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const {metadata, glb, coordinationMatrix} = await ifcToGLTF({
        url: ifcUrl,
        webIfcSettings: {
          wasm: {
            path: '/',
            absolute: true,
          },
        },
      });
      // FIXME: we are missing a mechnism to place the model at a particular place
      console.log('IFC transformed to glTF', metadata, coordinationMatrix);
      const glbBlob = new Blob([glb]);
      toRevokeUrl = URL.createObjectURL(glbBlob);
      const modelConfig: INGVCesiumModelConfig = {
        type: 'model',
        options: Object.assign({}, modelOptions, {
          url: toRevokeUrl,
          id: {
            name: ifcUrl,
          },
        }),
        height: config.height,
        position: config.position,
        rotation: config.rotation,
      };
      config = modelConfig;
    } else if (isModelConfig(config)) {
      config = {
        ...config,
        options: {...config.options, id: {name: config.options.url}},
      };
    }
    if (isModelConfig(config)) {
      const bmConfig: Omit<INGVCesiumModelConfig['options'], 'url'> = {
        scene: viewer.scene,
        gltfCallback(gltf) {
          // FIXME: here we can enable animations, ...
          // This should be exposed in some way to the apps
          console.log('received glTF', gltf);
        },
        // heightReference: HeightReference.CLAMP_TO_GROUND,
      };
      const modelMatrix = Transforms.headingPitchRollToFixedFrame(
        Cartographic.toCartesian(
          Cartographic.fromDegrees(
            config.position[0],
            config.position[1],
            config.height,
          ),
        ),
        new HeadingPitchRoll(CesiumMath.toRadians(config.rotation)),
        Ellipsoid.WGS84,
        Transforms.localFrameToFixedFrameGenerator('north', 'west'),
      );
      stuffToDo.push(
        instantiateModel(
          config,
          Object.assign(bmConfig, cesiumContext.layerOptions[path], {
            modelMatrix,
          }),
        )
          .then(
            (model) => {
              modelCallback(path, model);
              primitiveCollections.models.add(model);
            },
            (e) => {
              console.error('o', e);
            },
          )
          .finally(() => {
            if (toRevokeUrl) {
              URL.revokeObjectURL(toRevokeUrl);
            }
          }),
      );
    } else {
      throw new Error(`Not a supported model config: ${config.type}`);
    }
  });
  // Here we wait for all models to be loaded, before continuing.
  // It pleases the linter, but is to be decided if this is really necessary / suitable.
  if (modelPromises) {
    await Promise.allSettled(modelPromises);
  }

  cesiumContext.layers.imageries.map((name) => {
    const config = resolvedLayers[name];
    if (!isImageryConfig(config)) {
      throw new Error();
    }
    const provider = instantiateImageryProvider(
      config,
      cesiumContext.layerOptions[name],
    );
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

  return {viewer, dataSourceCollection, primitiveCollections};
}
