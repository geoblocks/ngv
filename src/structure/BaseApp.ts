import type {HTMLTemplateResult} from 'lit';
import {html, LitElement} from 'lit';
import {state} from 'lit/decorators.js';
import type {Status} from './ngv-structure-apploading.js';
import './ngv-structure-apploading.js';
import type {Locale} from './helpers/localeHelper.js';
import {detectOKLanguage, setLocale} from './helpers/localeHelper.js';
import type {INgvStructureApp} from './ngv-structure-app.js';

export abstract class ABaseApp<
  ConfigType extends INgvStructureApp,
> extends LitElement {
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
    configUrl: string | (() => Promise<{config: ConfigType}>),
  ) {
    this.configLoading = 'loading';
    try {
      if (typeof configUrl === 'function') {
        const {config} = await configUrl();
        this.config = config;
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

  constructor(configUrl: string | (() => Promise<{config: ConfigType}>)) {
    super();
    try {
      this.initializeLocale().catch(() => {});
      this.initializeConfig(configUrl)
        .then(async () => {
          const projections = this.config.projections;
          if (projections) {
            const proj4 = (await import('proj4')).default;
            if (Array.isArray(projections[0])) {
              proj4.defs(<[string, string][]>projections);
              return;
            }
            await Promise.all(
              (<{projection: [string, string]; gridFileName: string}[]>(
                projections
              )).map(async (proj) => {
                if (proj.gridFileName) {
                  try {
                    const response = await fetch(
                      `/src/helperFiles/${proj.gridFileName}.gsb`,
                    );
                    const buffer = await response.arrayBuffer();
                    proj4.nadgrid(proj.gridFileName, buffer);
                  } catch (error) {
                    console.error(error);
                  }
                }
                proj4.defs(proj.projection[0], proj.projection[1]);
              }),
            );
          }
        })
        .catch(() => {});
    } finally {
      // pass
    }
  }

  override render(): HTMLTemplateResult {
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
