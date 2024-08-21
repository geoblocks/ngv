import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

// Fixme: this should be one of the supported language.
// Per application?
type Language = "en" | "it" | "fr" | "de";

export interface INgvStructureApp {
  header: {
    logo: string;
    languages: Language[];
    title: Record<Language, string>;
  };
  footer: {
    impressum: Record<Language, string>;
    contact: string;
  };
}

/**
 * This element structures the app using slots.
 */
@customElement("ngv-structure-app")
export class NgvStructureApp extends LitElement {
  @property({ type: Object })
  config: INgvStructureApp;

  constructor() {
    super();
    // this.shadowRoot.adoptedStyleSheets.push(styles);
  }

  render() {
    const { header, footer } = this.config;
    return html`
      <header>
        <img src="${header.logo}" />
        <div>
          <label for="language">Lang:</label>
          <select name="language" id="language">
            ${header.languages.map(
              (l) => html`<option value="${l}">${l}</option>`,
            )}
          </select>
        </div>
      </header>
      <main>
        <slot></slot>
      </main>
      <footer>
        <p>${footer.impressum}</p>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ngv-structure-app": NgvStructureApp;
  }
}
