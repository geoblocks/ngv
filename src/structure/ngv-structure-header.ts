import type {HTMLTemplateResult} from 'lit';
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {INgvStructureApp} from './ngv-structure-app.js';
import {getLocale, setLocale} from './helpers/localeHelper.js';

@customElement('ngv-structure-header')
export class NgvStructureHeader extends LitElement {
  @property({type: Object})
  config: INgvStructureApp;

  static styles = css`
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px;
    }
  `;

  render(): HTMLTemplateResult {
    const currentLocale = getLocale();
    return html`
      <header>
        <img src="${this.config.header.logo}" />
        <div>
          <label for="language">Lang:</label>
          <select
            name="language"
            id="language"
            @change=${async (evt: Event) => {
              const el = evt.target as HTMLSelectElement;
              const locale = this.config.languages[el.selectedIndex];
              await setLocale(locale);
            }}
          >
            ${this.config.languages.map(
              (l) =>
                html`<option value="${l}" ?selected=${l === currentLocale}>
                  ${l}
                </option>`,
            )}
          </select>
        </div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-structure-header': NgvStructureHeader;
  }
}
