import type {ImageryProvider} from '@cesium/engine';
import {
  Ion,
  Math as CesiumMath,
  CesiumWidget,
  Cartesian3,
  Model,
} from '@cesium/engine';

import type {
  INGVCesium3DTiles,
  INGVCesiumModel,
  INGVCesiumAllTypes,
  INGVCesiumImageryTypes,
  INGVCesiumTerrain,
  INGVIFC,
} from 'src/interfaces/ingv-layers.js';
import {
  Cesium3DTileset,
  CesiumTerrainProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from '@cesium/engine';
import type {IngvCesiumContext} from 'src/interfaces/ingv-cesium-context.js';
import type {INGVCatalog} from 'src/interfaces/ingv-catalog.js';

function withExtra<T>(options: T, extra: Record<string, any>): T {
  if (!extra) {
    return options;
  }
  return Object.assign({}, options, extra) as T;
}

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
  config: INGVCesiumModel,
  extraOptions?: Record<string, any>,
): Promise<Model> {
  return Model.fromGltfAsync(withExtra(config.options, extraOptions));
}

export async function instantiate3dTileset(
  config: INGVCesium3DTiles,
  extraOptions?: Record<string, any>,
): Promise<Cesium3DTileset> {
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
    return createGooglePhotorealistic3DTileset(key);
  }
  if (typeof url === 'string') {
    return Cesium3DTileset.fromUrl(
      url,
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
): config is INGVCesiumModel {
  return config?.type === 'model';
}

export function isIFCConfig(config: INGVCesiumAllTypes): config is INGVIFC {
  return config?.type === 'ifc';
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
): Promise<CesiumWidget> {
  modelCallback =
    modelCallback ||
    (() => {
      console.warn('Missing modelCallback');
    });
  window.CESIUM_BASE_URL = cesiumContext.baseUrl || '/';

  if (cesiumContext.cesiumApiKey) {
    Ion.defaultAccessToken = cesiumContext.cesiumApiKey;
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
    Object.assign({}, cesiumContext.widgetOptions),
  );

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
      instantiate3dTileset(config, cesiumContext.layerOptions[name]).then(
        (tileset) => {
          viewer.scene.primitives.add(tileset);
        },
      ),
    );
  });

  cesiumContext.layers.models?.forEach((name) => {
    const config = resolvedLayers[name];
    if (isModelConfig(config)) {
      stuffToDo.push(
        instantiateModel(config, cesiumContext.layerOptions[name]).then(
          (model) => {
            console.log('Got model!', config);
            modelCallback(name, model);
            viewer.scene.primitives.add(model);
          },
          (e) => {
            console.error('o', e);
          },
        ),
      );
    } else if (isIFCConfig(config)) {
      stuffToDo.push(
        import('@geoblocks/ifc-gltf').then(async (module) => {
          const {ifcToGLTF} = module;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const {metadata, glb, coordinationMatrix} = await ifcToGLTF({
            url: config.url,
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
          const glbURL = URL.createObjectURL(glbBlob);
          const modelConfig: INGVCesiumModel = {
            type: 'model',
            options: Object.assign({}, config.options?.modelOptions, {
              url: glbURL,
            }),
          };
          return instantiateModel(modelConfig, cesiumContext.layerOptions[name])
            .then(
              (model) => {
                modelCallback(name, model);
                console.log('Got IFC!', config, modelConfig);
                viewer.scene.primitives.add(model);
              },
              (e) => {
                console.error('o', e);
              },
            )
            .finally(() => {
              URL.revokeObjectURL(glbURL);
            });
        }),
      );
    } else {
      throw new Error(`Not a supported model config: ${config.type}`);
    }
  });

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

  return viewer;
}
