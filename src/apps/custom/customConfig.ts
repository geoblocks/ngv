import type {IngvAuthContext} from '../../interfaces/auth/ingv-auth-context.js';
import type {CustomConfig} from './ingv-config-custom.js';

// See https://developers.google.com/identity/openid-connect/openid-connect#discovery
const wellknown = {
  authorization_endpoint:
    'https://sso.geomapfish-demo.prod.apps.gs-ch-prod.camptocamp.com/oauth/v2/authorize',
  token_endpoint:
    'https://sso.geomapfish-demo.prod.apps.gs-ch-prod.camptocamp.com/oauth/v2/token',
};

const authContext: IngvAuthContext = {
  provider: {
    type: 'oidc',
    wellknown,
    options: {
      redirectUri: `${document.location.origin}/src/apps/custom/index.html`,
      clientId: '294600834753305656',
      scopes: ['openid', 'offline_access', 'profile', 'email'],
      pkce: true,
    },
  },
};
export const config: CustomConfig = {
  languages: ['fr', 'en'],
  header: {
    title: {
      fr: 'Ma custom app',
      en: 'My custom app',
    },
    searchContext: {
      providers: [
        {
          type: 'geoadmin',
          options: {
            sr: '2056',
            limit: 10,
          },
        },
        {
          type: 'nominatim',
          options: {
            limit: 10,
          },
        },
      ],
    },
  },
  authContext,
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
