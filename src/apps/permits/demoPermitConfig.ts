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
    },
  },
};
