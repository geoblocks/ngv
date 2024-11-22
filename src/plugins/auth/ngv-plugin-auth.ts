import type {HTMLTemplateResult} from 'lit';
import {LitElement, html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {getProvider} from './ngv-auth-providers.js';
import type {IngvAuthProvider} from '../../interfaces/auth/ingv-auth-provider.js';
import type {IngvAuthContext} from '../../interfaces/auth/ingv-auth-context.js';

@customElement('ngv-plugin-auth')
export class NgvPluginAuth extends LitElement {
  @property({type: Object})
  authContext: IngvAuthContext;

  // we need an observable / state
  @state()
  status: IngvAuthProvider['status'];

  provider: IngvAuthProvider;

  private async initAuth(): Promise<void> {
    this.provider = await getProvider(this.authContext.provider.type);
    await this.provider.initialize(this.authContext.provider);
    this.status = this.provider.status;
  }

  protected firstUpdated(): void {
    this.initAuth().catch((e) => {
      console.error('Error during auth initialization: ', e);
    });
  }

  render(): HTMLTemplateResult {
    switch (this.status) {
      case 'unknown':
        return html`?`;
      case 'logged':
        return html`<button
          @click=${async () => {
            await this.provider.logout();
            this.status = this.provider.status;
          }}
        >
          logout
        </button>`;
      case 'unlogged':
        if (this.provider.useForm) {
          return html`some form`;
        }
        return html`<button
          @click=${async () => {
            await this.provider.login();
            this.status = this.provider.status;
          }}
        >
          login
        </button>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-auth': NgvPluginAuth;
  }
}
