import type {HTMLTemplateResult} from 'lit';
import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {IngvSearchContext} from '../../interfaces/search/ingv-search-context.js';
import type {
  INGVSearchProvider,
  INGVSearchResult,
} from '../../interfaces/search/ingv-search-provider.js';
import {getProvider} from './ngv-search-providers.js';
import {getLocale} from '../../structure/helpers/localeHelper.js';

@customElement('ngv-plugin-search')
export class NgvPluginSearch extends LitElement {
  @property({type: Object})
  searchContext: IngvSearchContext;

  providers: INGVSearchProvider[] = [];

  @property({type: Array})
  results: INGVSearchResult[] = [];

  private async initSearch(): Promise<void> {
    this.providers = await Promise.all(
      this.searchContext.providers.map((p) => getProvider(p)),
    );
  }

  protected firstUpdated(): void {
    this.initSearch().catch((e) => {
      console.error('Error during cesium viewer initialization: ', e);
    });
  }

  render(): HTMLTemplateResult {
    return html`<div
        id="search"
        @change=${async (evt: Event) => {
          const text = (evt.target as HTMLInputElement).value;
          const lang = getLocale();
          const results = await Promise.all(
            this.providers.map((p) => p.search(text, lang)),
          );
          this.results = results.flat();
        }}
      >
        Search: <input />
      </div>
      <ul>
        ${this.results.map((r) => html`<li>${r.title}</li>`)}
      </ul> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-search': NgvPluginSearch;
  }
}
