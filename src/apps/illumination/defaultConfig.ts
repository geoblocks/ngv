import type {IIlluminationConfig} from './ingv-config-illumination.js';

export const defaultConfig: IIlluminationConfig = {
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
        '@geoadmin': () => import('../../catalogs/geoadminCatalog.js'),
      },
      layers: {
        tiles3d: ['@geoadmin/buildings', '@geoadmin/vegetation'],
        imageries: ['@geoadmin/pixel-karte-farbe'],
        terrain: '@geoadmin/terrain',
      },
      quickLists: {
        baseLayers: [
          '@geoadmin/pixel-karte-farbe',
          '@geodmin/pixel-karte-frau',
          '@geoadmin/swissimage',
        ],
      },
      camera: {
        position: [6.628484, 46.5, 1000],
        orientation: {
          heading: 0,
          pitch: -30.0,
        },
      },
      widgetOptions: {
        shadows: true,
        terrainShadows: 1,
        scene3DOnly: true,
      },
    },
  },
};
