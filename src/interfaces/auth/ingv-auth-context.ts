/**
 * The well known configuration for an OpenID Connect provider
 */
interface OidcWellKnownConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  logout_endpoint: string;
}

export interface OidcProviderConfig {
  type: 'oidc';
  wellknown: OidcWellKnownConfig;
  clientId: string;
  pkce?: boolean;
  redirectUri: string; // automatic?
}

export interface FormProviderConfig {
  type: 'form';
  loginUrl: string;
  logoutUrl: string;
  userUrl: string;
}

export interface IngvAuthContext {
  provider: OidcProviderConfig | FormProviderConfig;
}
