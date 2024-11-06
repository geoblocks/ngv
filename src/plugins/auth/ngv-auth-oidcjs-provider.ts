import Client from '@geoblocks/oidcjs';
import type {OidcProviderConfig} from '../../interfaces/auth/ingv-auth-context.js';

class OidcProvider {
  private oidcClient: Client;
  private config: OidcProviderConfig;
  public status: 'unknown' | 'logged' | 'unlogged' = 'unknown';

  get useForm() {
    return false;
  }

  async initialize(config: OidcProviderConfig): Promise<void> {
    this.config = config;
    this.oidcClient = new Client(
      {
        redirectUri: config.redirectUri,
        clientId: config.clientId,
        pkce: !!config.usePkce,
        checkToken: () => {
          return Promise.resolve(true);
        },
      },
      config.wellknown,
    );

    await this.finishAuthenticationProcedure();
    try {
      const token = await this.oidcClient.getActiveToken();
      if (!token || token === '') {
        return undefined;
      }
      const parsedToken = this.oidcClient.parseJwtPayload(token);
      console.log('activeToken', parsedToken);
      this.status = 'logged';
      return undefined;
    } catch (e) {
      console.error('could not initialize user', e);
      // return Promise.reject(e);
    }
  }

  private async finishAuthenticationProcedure() {
    const postLogoutUrl = localStorage.getItem('appPostLogoutURL');
    if (postLogoutUrl) {
      localStorage.removeItem('appPostLogoutURL');
      document.location = postLogoutUrl;
      return;
    }
    const preLoginUrl = localStorage.getItem('appPreLoginURL');
    if (!preLoginUrl) {
      return;
    }
    try {
      const searchParams = new URLSearchParams(document.location.search);
      await this.oidcClient.handleStateIfInURL(searchParams).then((results) => {
        switch (results.status) {
          case 'completed': {
            localStorage.removeItem('appPreLoginURL');
            document.location = preLoginUrl;
            return;
          }
          case 'invalid':
          case 'error': {
            // Display an error message
            console.log('Login failed', results.msg);
            return;
          }
          case 'nothing': {
            // Do nothing
            return;
          }
        }
      });
    } catch (error) {
      console.log('Login failed', error);
    }
  }

  async login(): Promise<void> {
    localStorage.setItem('appPreLoginURL', document.location.href);
    try {
      const loginURL =
        await this.oidcClient.createAuthorizeAndUpdateLocalStorage([
          'openid',
          'roles',
        ]);
      document.location = loginURL;
    } catch (error) {
      console.error('Error:', error);
    }
    return Promise.resolve();
  }

  logout(): Promise<void> {
    const idToken = localStorage.getItem('oidcjs_id_token');
    this.oidcClient.lclear();
    // we will reload the page during the logout process so we don't have to clear the user status
    // in addition, that would interfere with the logout process

    // Also logout from the SSO itself (not only the app)
    const newLocation = new URL(this.config.wellknown.logout_endpoint);
    newLocation.searchParams.append(
      'post_logout_redirect_uri',
      this.config.redirectUri,
    );
    newLocation.searchParams.append('client_id', this.config.clientId);
    newLocation.searchParams.append('id_token_hint', idToken);
    localStorage.setItem('appPostLogoutURL', document.location.href);
    document.location = newLocation.toString();
    this.status = 'unlogged';
    return Promise.resolve();
  }
}

export const provider = new OidcProvider();
