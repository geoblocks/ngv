import { IngvAuthContext } from '../../interfaces/auth/ingv-auth-context.js';
import type { CustomConfig } from './ingv-config-custom.js';

const mainURL = "https://keycloak.qa.fastforward.ch/realms/smobil-staging";

const wellknown = {
  authorization_endpoint: `${mainURL}/protocol/openid-connect/auth?prompt=login`,
  token_endpoint: `${mainURL}/protocol/openid-connect/token`,
  logout_endpoint: `${mainURL}/protocol/openid-connect/logout`,
};

const authContext: IngvAuthContext = {
  provider: {
    type: "oidc",
    // This is the URI that keycloak will use to finish the authentication process
    // It must be an exact URL, not a prefix.
    redirectUri: "http://localhost:8000/",
    // The client ID is provided by your SSO server
    clientId: "schweizmobil-website",
    // PKCE is an optional security feature, that must be enabled in your SSO server.
    pkce: true,
    // You can create the well-known configuration yourself or retrieve it from your SSO server.
    wellknown,
  }
}
  ;


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
