import type {HTMLTemplateResult} from 'lit';
import {css} from 'lit';
import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {Locale} from './helpers/localeHelper.js';
import {getLocale} from './helpers/localeHelper.js';

import './ngv-page.js';
import './ngv-structure-header.js';
import type {IngvSearchContext} from '../interfaces/search/ingv-search-context.js';
import type {IngvAuthContext} from '../interfaces/auth/ingv-auth-context.js';

export type ProjectionWithGrid = {
  projection: [string, string];
  gridKey: string;
  gridUrl: string;
};

export interface INgvStructureApp {
  languages: Partial<Locale>[];
  authContext?: IngvAuthContext;
  header: {
    logo?: string;
    title: Partial<Record<Locale, string>>;
    searchContext?: IngvSearchContext;
  };
  footer?: {
    impressum?: Partial<Record<Locale, string>>;
    contact?: string;
  };
  projections?: [string, string][] | ProjectionWithGrid[];
}

/**
 * This element structures the app using slots.
 */
@customElement('ngv-structure-app')
export class NgvStructureApp extends LitElement {
  @property({type: Object})
  config: INgvStructureApp;

  static styles = [
    css`
      :host {
        width: 100%;
        height: 100%;
      }
    `,
  ];

  shouldUpdate(): boolean {
    return !!this.config;
  }

  render(): HTMLTemplateResult {
    // <div slot="header">
    //           <ngv-structure-header .config=${this.config}></ngv-structure-header>
    //         </div>
    return html`
      <ngv-page>
        <div slot="menu"><slot name="menu"></slot></div>
        <div slot="main-content" style="height: 100%"><slot></slot></div>
        <div slot="main-footer">
          <footer>
            ${this.config.footer?.impressum
              ? html`<p>
                  ${this.config.footer.impressum[getLocale() as Locale]}
                </p>`
              : ''}
          </footer>
        </div>
      </ngv-page>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-structure-app': NgvStructureApp;
  }
}
