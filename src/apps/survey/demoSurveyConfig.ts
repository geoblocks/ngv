import type {ISurveyConfig} from './ingv-config-survey.js';

export const config: ISurveyConfig = {
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
      catalogs: {
        '@cesium': () => import('../../catalogs/cesiumCatalog.js'),
        '@demo': () => import('../../catalogs/demoCatalog.js'),
      },
      layers: {
        // tiles3d: ['@demo/castle'],
        imageries: ['@cesium/openstreetmap'],
      },
      quickLists: {
        baseLayers: ['@cesium/openstreetmap'],
      },
      camera: {
        position: [-5.517543730925392, 57.27447291204438, 1000],
        orientation: {
          heading: 0,
          pitch: -30.0,
        },
      },
      views: [
        {
          positions: [
            [-5.517543730925392, 57.27447291204438],
            [-5.516081775796481, 57.27485081768119],
            [-5.514924238059451, 57.27369880290402],
            [-5.516224588893907, 57.273339171861174],
          ],
          height: 40,
          elevation: 0,
          flyDuration: 2,
          title: 'Eilean Donan Castle',
          fovAngle: 45,
        },
        {
          positions: [
            [-1.1459364049250647, 60.156072543804996],
            [-1.1443272025193694, 60.1562370324715],
            [-1.1438096482321323, 60.154899456027685],
            [-1.1455449773128685, 60.15467652132899],
          ],
          height: 15,
          elevation: 0,
          flyDuration: 2,
          title: 'Fort Charlotte, Shetland',
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
        showTerrainDistance: false,
        projection: 'EPSG:27700',
      },
      measureOptions: {
        showSegmentsInfo: true,
        showHeightDifferance: true,
      },
      clippingOptions: {
        tilesClippingEnabled: true,
        terrainClippingEnabled: false,
        storeKey: 'survey-localStoreClipping',
      },
    },
  },
  projections: [
    {
      projection: [
        'EPSG:27700',
        '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +no_defs +nadgrids=OSTN15_NTv2_OSGBtoETRS',
      ],
      gridFileName: 'OSTN15_NTv2_OSGBtoETRS',
    },
  ],
};
