import type {HTMLTemplateResult} from 'lit';
import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {Locale} from './helpers/localeHelper.js';
import {getLocale} from './helpers/localeHelper.js';

import './ngv-page.js';
import './ngv-structure-header.js';
import type {IngvSearchContext} from '../interfaces/search/ingv-search-context.js';
import type {IngvAuthContext} from '../interfaces/auth/ingv-auth-context.js';

export interface INgvStructureApp {
  languages: Partial<Locale>[];
  authContext?: IngvAuthContext;
  header: {
    logo?: string;
    title: Partial<Record<Locale, string>>;
    searchContext?: IngvSearchContext;
  };
  footer: {
    impressum: Partial<Record<Locale, string>>;
    contact: string;
  };
  projections?: [string, string][];
}

/**
 * This element structures the app using slots.
 */
@customElement('ngv-structure-app')
export class NgvStructureApp extends LitElement {
  @property({type: Object})
  config: INgvStructureApp;

  constructor() {
    super();
    // this.shadowRoot.adoptedStyleSheets.push(styles);
  }

  shouldUpdate(): boolean {
    return !!this.config;
  }

  render(): HTMLTemplateResult {
    return html`
      <ngv-page>
        <div slot="header">
          <ngv-structure-header .config=${this.config}></ngv-structure-header>
        </div>
        <div slot="menu"><slot name="menu"></slot></div>
        <!-- <div slot="main-header">main-header</div> -->
        <div slot="main-content" style="height: 100%"><slot></slot></div>
        <div slot="main-footer">
          <footer>
            <p>${this.config.footer.impressum[getLocale() as Locale]}</p>
          </footer>
        </div>
        <!-- <div slot="aside">aside</div> -->
        <!-- <div slot="footer">footer</div> -->
      </ngv-page>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-structure-app': NgvStructureApp;
  }
}
