import type {HTMLTemplateResult} from 'lit';
import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {Locale} from './helpers/localeHelper.js';
import {getLocale, setLocale} from './helpers/localeHelper.js';

export interface INgvStructureApp {
  languages: Locale[];
  header: {
    logo?: string;
    title: Record<Locale, string>;
  };
  footer: {
    impressum: Record<Locale, string>;
    contact: string;
  };
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

  render(): HTMLTemplateResult {
    if (!this.config) {
      return undefined;
    }
    const {header, footer, languages} = this.config;
    const currentLocale = getLocale();
    return html`
      <header>
        <img src="${header.logo}" />
        <div>
          <label for="language">Lang:</label>
          <select
            name="language"
            id="language"
            @change=${async (evt: Event) => {
              const el = evt.target as HTMLSelectElement;
              const locale = languages[el.selectedIndex];
              await setLocale(locale);
            }}
          >
            ${languages.map(
              (l) =>
                html`<option value="${l}" ?selected=${l === currentLocale}>
                  ${l}
                </option>`,
            )}
          </select>
        </div>
      </header>
      <main>
        <slot></slot>
      </main>
      <footer>
        <p>${footer.impressum[getLocale() as Locale]}</p>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-structure-app': NgvStructureApp;
  }
}
