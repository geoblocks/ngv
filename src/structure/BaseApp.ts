import {html, LitElement, TemplateResult} from 'lit';
import {state} from 'lit/decorators.js';
import {Status} from './ngv-structure-apploading.js';
import './ngv-structure-apploading.js';

import {detectOKLanguage, Locale, setLocale} from './helpers/localeHelper.js';

export abstract class ABaseApp<ConfigType> extends LitElement {
  @state()
  protected config: ConfigType;

  @state()
  localeLoading: Status;

  @state()
  configLoading: Status;

  private async initializeLocale() {
    window.addEventListener('lit-localize-status', (event) => {
      this.localeLoading = event.detail.status;
    });
    const language: Locale | 'en' = detectOKLanguage(window.navigator) || 'en';
    try {
      await setLocale(language);
    } catch (e) {
      this.localeLoading = 'error';
      console.error(e, 'Could not set locale');
    }
  }

  private async initializeConfig(
    configUrl: string | (() => Promise<{defaultConfig: ConfigType}>),
  ) {
    this.configLoading = 'loading';
    try {
      if (typeof configUrl === 'function') {
        const {defaultConfig} = await configUrl();
        this.config = defaultConfig;
      } else {
        const result = await fetch(configUrl);
        this.config = (await result.json()) as ConfigType;
      }

      this.configLoading = 'ready';
    } catch (e) {
      this.configLoading = 'error';
      console.error(e);
    }
  }

  constructor(
    configUrl: string | (() => Promise<{defaultConfig: ConfigType}>),
  ) {
    super();
    try {
      this.initializeLocale().catch(() => {});
      this.initializeConfig(configUrl).catch(() => {});
    } finally {
      // pass
    }
  }

  override render(): TemplateResult {
    if (this.configLoading === 'ready' && this.localeLoading === 'ready') {
      return undefined;
    }
    return html`
      <ngv-structure-apploading
        .config=${this.configLoading}
        .language=${this.localeLoading}
      ></ngv-structure-apploading>
    `;
  }
}
