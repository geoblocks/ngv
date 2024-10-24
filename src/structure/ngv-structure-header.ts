import type {HTMLTemplateResult} from 'lit';
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {INgvStructureApp} from './ngv-structure-app.js';
import {getLocale, setLocale} from './helpers/localeHelper.js';
import '../plugins/search/ngv-plugin-search.js';
import '../plugins/auth/ngv-plugin-auth';

import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import type SlSelect from '@shoelace-style/shoelace/dist/components/select/select.js';

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
    const headerConfig = this.config.header;
    return html`
      <header>
        <img src="${headerConfig.logo}" />

        ${headerConfig.searchContext
          ? html`<ngv-plugin-search
              .searchContext=${headerConfig.searchContext}
            ></ngv-plugin-search>`
          : ''}
        ${this.config.authContext
          ? html`
              <ngv-plugin-auth
                .authContext=${this.config.authContext}
              ></ngv-plugin-auth>
            `
          : ''}

        <div part="language-chooser">
          <sl-select
            label="Language"
            size="small"
            value="${getLocale()}"
            @sl-change=${async (evt: Event) => {
              const el = evt.target as SlSelect;
              await setLocale(el.value as string);
            }}
          >
            <sl-icon name="translate" slot="prefix"></sl-icon>
            ${this.config.languages.map(
              (l) => html`<sl-option value="${l}">${l}</sl-option>`,
            )}
          </sl-select>
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
