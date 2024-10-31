import type {CustomConfig} from './ingv-config-custom.js';

export const config: CustomConfig = {
  languages: ['fr', 'en'],
  header: {
    title: {
      fr: 'Ma custom app',
      en: 'My custom app',
    },
    searchContext: {
      providers: ['geoadmin'],
    },
  },
  footer: {
    contact: 'me@example.com',
    impressum: {
      fr: 'Bla bla FR impressim',
      en: 'Bla bla EN impressim',
    },
  },
  app: {
    cesiumContext: {
      catalogs: {
        '@geoadmin': () => import('../../catalogs/geoadminCatalog.js'),
      },
      layers: {
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
    },
  },
};
