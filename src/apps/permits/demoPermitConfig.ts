import type {IPermitsConfig} from './ingv-config-permits.js';

export const config: IPermitsConfig = {
  languages: ['de', 'fr', 'en', 'it'],
  header: {
    title: {
      fr: 'Ma super app',
      en: 'My super app',
      de: 'Meine supper app',
      it: 'Mia super app',
    },
  },
  footer: {
    contact: 'me@example.com',
    impressum: {
      fr: 'Bla bla FR impressim',
      en: 'Bla bla EN impressim',
      de: 'Bla bla DE impressim',
      it: 'Bla bla IT impressim',
    },
  },
  app: {
    cesiumContext: {
      name: 'permits',
      catalogs: {
        '@cesium': () => import('../../catalogs/cesiumCatalog.js'),
        '@geoadmin': () => import('../../catalogs/geoadminCatalog.js'),
        '@demo': () => import('../../catalogs/demoCatalog.js'),
      },
      layers: {
        tiles3d: ['@geoadmin/buildings'], // @cesium/googlePhotorealistic
        models: ['@demo/sofa', '@demo/thatopensmall'],
        imageries: ['@geoadmin/pixel-karte-farbe'],
        terrain: '@geoadmin/terrain',
      },
      quickLists: {
        baseLayers: ['@geoadmin/pixel-karte-farbe'],
      },
      camera: {
        position: [6.628484, 46.5, 1000],
        orientation: {
          heading: 0,
          pitch: -30.0,
        },
      },
      views: [
        {
          id: 'building-1',
          positions: [
            [6.62571, 46.50666],
            [6.62582, 46.50659],
            [6.62556, 46.50655],
            [6.62566, 46.50648],
          ],
          height: 5,
          elevation: 374,
          flyDuration: 2,
          title: 'Building',
          fovAngle: 45,
        },
        {
          id: 'building-2',
          positions: [
            [6.62582, 46.50651],
            [6.62587, 46.50654],
            [6.62592, 46.50651],
            [6.62587, 46.50648],
          ],
          height: 2,
          elevation: 374,
          flyDuration: 2,
          title: 'Building 2',
          fovAngle: 45,
        },
      ],
      layerOptions: {},
      widgetOptions: {
        scene3DOnly: true,
      },
      globeOptions: {
        depthTestAgainstTerrain: true,
      },
      clickInfoOptions: {
        type: 'html',
        showWgs84: true,
        showAmslElevation: true,
        showTerrainDistance: true,
        projection: 'EPSG:21781',
      },
      measureOptions: {
        showSegmentsInfo: true,
        showHeightDifferance: true,
      },
      clippingOptions: {
        storeKey: 'permits-localStoreClipping',
      },
    },
  },
  projections: [
    [
      'EPSG:21781',
      '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs',
    ],
  ],
};
