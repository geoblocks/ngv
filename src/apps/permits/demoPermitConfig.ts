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
      catalogs: {
        '@cesium': () => import('../../catalogs/cesiumCatalog.js'),
        '@geoadmin': () => import('../../catalogs/geoadminCatalog.js'),
        '@demo': () => import('../../catalogs/demoCatalog.js'),
      },
      layers: {
        tiles3d: ['@geoadmin/buildings'], // @cesium/googlePhotorealistic
        // models: ['@demo/sofa', '@demo/thatopensmall'],
        imageries: ['@geoadmin/pixel-karte-farbe'],
        terrain: '@geoadmin/terrain',
      },
      camera: {
        position: [6.628484, 46.5, 1000],
        orientation: {
          heading: 0,
          pitch: -30.0,
        },
      },
      layerOptions: {},
      widgetOptions: {
        scene3DOnly: true,
      },
      globeOptions: {
        depthTestAgainstTerrain: true,
      },
    },
  },
};
