import {html, LitElement} from 'lit';
import type {HTMLTemplateResult, TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {msg} from '@lit/localize';
import type {
  LabelValue,
  SurveyCheckbox,
  SurveyCoords,
  SurveyField,
  SurveyFile,
  SurveyReadonly,
  SurveyInput,
  SurveyRadio,
  SurveySelect,
  SurveyTextarea,
  SurveyId,
  FieldOptions,
  SurveyColorpicker,
} from '../../interfaces/ui/ingv-survey.js';
import {Task} from '@lit/task';
import {classMap} from 'lit/directives/class-map.js';
import './ngv-upload';
import type {FileUploadDetails} from './ngv-upload.js';
import {fileToBase64} from '../../utils/file-utils.js';
import type {Coordinates, FieldValues} from '../../utils/generalTypes.js';
import {until} from 'lit/directives/until.js';

@customElement('ngv-survey')
export class NgvSurvey extends LitElement {
  @property({type: Array})
  public surveyFields: SurveyField[];
  @property({type: Object})
  public fetchFieldValues: Promise<FieldValues> | undefined;
  @property({type: String})
  public projection: string;
  @state()
  notValid: Record<string, boolean> = {};
  @state()
  public fieldValues: FieldValues | undefined;

  private surveyConfigChange = new Task(this, {
    args: (): [SurveyField[], Promise<FieldValues>] => [
      this.surveyFields,
      this.fetchFieldValues,
    ],
    task: async ([surveyConfig, fieldValues]) => {
      const fields: Record<string, any> = await fieldValues;
      if (fields) {
        surveyConfig.forEach((item) => {
          if (!fields[item.id]) {
            if (item.type === 'checkbox') {
              if (typeof item.options === 'function') {
                throw new Error(
                  `The option field ${item.id} should have been resolved`,
                );
              }
              if (Array.isArray(item.options)) {
                item.options.forEach((opt) => {
                  if (!fields[item.id]) {
                    fields[item.id] = {};
                  }
                  (<Record<string, boolean>>fields[item.id])[opt.value] =
                    opt.checked;
                });
              }
            } else if (item.type === 'input' && item.inputType === 'date') {
              const date = new Date().toISOString();
              fields[item.id] = date.substring(0, date.indexOf('T'));
            } else {
              fields[item.id] =
                item.type !== 'file' && item.type !== 'id'
                  ? item.defaultValue
                  : '';
            }
          }
        });
      }
      this.fieldValues = fields;
    },
  });

  renderInput(options: SurveyInput): TemplateResult<1> | '' {
    const isText = options.inputType === 'text';
    const value = options.valueCallback
      ? options.valueCallback(this.fieldValues)
      : this.fieldValues[options.id] || '';
    return html`
      <div class="field">
        <span class="ngv-survey-label" .hidden="${!options.label?.length}"
          >${options.label}
          ${
            options.required ? html`<span style="color: red">*</span>` : ''
          }</label
        >
        <wa-input
          size="small"
          class="${classMap({'ngv-warning': this.notValid[options.id]})}"
          .type="${options.inputType}"
          .placeholder="${options.placeholder || ''}"
          .value="${value}"
          disabled="${options.disabled}"
          .minlength="${isText && options.min ? options.min : null}"
          .maxlength="${isText && options.max ? options.max : null}"
          .min="${!isText && options.min ? options.min : null}"
          .max="${!isText && options.max ? options.max : null}"
          .required="${options.required}"
          @input=${(evt: Event) => {
            let value: string | number = (<HTMLInputElement>evt.target).value;
            if (options.inputType === 'number') {
              value = Number(value);
              const max = Number(options.max);
              const min = Number(options.min);
              value = value > max ? max : value;
              value = value < min ? min : value;
            }
            this.fieldValues[options.id] = value;
            if (this.notValid[options.id]) this.notValid[options.id] = false;
            this.requestUpdate();
          }}
        />
      </div>
    `;
  }

  renderTextarea(options: SurveyTextarea): TemplateResult<1> | '' {
    return html` <div>
      <span class="ngv-survey-label" .hidden="${!options.label?.length}"
        >${options.label}
        ${options.required ? html`<span style="color: red">*</span>` : ''}</span
      >
      <wa-textarea
        size="small"
        class="${classMap({'ngv-warning': this.notValid[options.id]})}"
        .placeholder="${options.placeholder || ''}"
        .minlength="${options.min}"
        .maxlength="${options.max}"
        .required="${options.required}"
        .value=${this.fieldValues[options.id] || ''}
        @input=${(evt: Event) => {
          this.fieldValues[options.id] = (<HTMLInputElement>evt.target).value;
          if (this.notValid[options.id]) {
            this.notValid = {...this.notValid, [options.id]: false};
          }
        }}
      >
      </wa-textarea>
    </div>`;
  }

  renderColorpicker(options: SurveyColorpicker): TemplateResult<1> | '' {
    const value = options.valueCallback
      ? options.valueCallback(this.fieldValues)
      : this.fieldValues[options.id] || '';
    return html`<div>
      ${options.label?.length
        ? html`<span class="ngv-survey-label">
            ${options.label}
            ${options.required ? html`<span style="color: red">*</span>` : ''}
          </label>`
        : ''}<wa-color-picker
        size="small"
        .value=${value}
        .disabled=${options.disabled}
      ></wa-color-picker>
    </div>`;
  }

  resolveOptions(
    config: SurveyRadio | SurveyCheckbox | SurveySelect,
  ): LabelValue[] | undefined {
    // options resolved in index.ts, resolveFieldsConfig
    let options = <FieldOptions>config.options;
    if (!Array.isArray(options) && (config.keyPropId || config.keyCallback)) {
      const key = config.keyCallback
        ? config.keyCallback(this.fieldValues)
        : <string>this.fieldValues[config.keyPropId];
      options = options[key];
    }
    if (Array.isArray(options) && options?.length) return options;
    else return undefined;
  }

  renderSelect(config: SurveySelect): TemplateResult<1> | '' {
    const options = this.resolveOptions(config);
    if (!options) return '';
    return html`<div>
      <span class="ngv-survey-label" .hidden="${!config.label}"
        >${config.label}
        ${config.required ? html`<span style="color: red">*</span>` : ''}</label
      >
      <wa-select
        size="small"
        class="${classMap({'ngv-warning': this.notValid[config.id]})}"
        .required="${config.required}"
        value=${this.fieldValues[config.id]}
        .placeholder=${msg('Select an option')}
        @change=${(evt: Event) => {
          this.fieldValues[config.id] = (<HTMLSelectElement>evt.target).value;
          if (this.notValid[config.id]) {
            this.notValid = {...this.notValid, [config.id]: false};
          }
          this.requestUpdate();
        }}
      >
        ${options.map(
          (option) =>
            html`<wa-option value=${option.value}>
              ${option.label}
            </wa-option>`,
        )}
      </wa-select>
    </div>`;
  }

  renderCheckbox(config: SurveyCheckbox): TemplateResult<1> | '' {
    const options = this.resolveOptions(config);
    if (!options) return '';
    const checkbox = (option: LabelValue) =>
      html`<div
        class="${classMap({
          'ngv-warning':
            this.notValid[config.id] && config.options?.length === 1,
        })}"
      >
        <wa-checkbox
          size="small"
          .checked=${(<Record<string, boolean>>this.fieldValues[config.id])[
            option.value
          ]}
          @click=${(evt: Event) => {
            if (!this.fieldValues[config.id]) {
              this.fieldValues[config.id] = {};
            }
            (<Record<string, boolean>>this.fieldValues[config.id])[
              option.value
            ] = (<HTMLInputElement>evt.target).checked;
            if (this.notValid[config.id]) {
              this.notValid = {...this.notValid, [config.id]: false};
            }
            this.requestUpdate();
          }}
        >
          ${option.label}
        </wa-checkbox>
      </div>`;
    return html`${options?.length > 1
      ? html` <div
          class="${classMap({'ngv-warning': this.notValid[config.id]})}"
        >
          <span class="ngv-survey-label" .hidden="${!config.label}">
            ${config.label}
            ${config.required ? html`<span style="color: red">*</span>` : ''}
          </span>
          ${options.map(checkbox)}
        </div>`
      : checkbox(options[0])}`;
  }

  renderRadio(config: SurveyRadio): TemplateResult<1> | '' {
    const options = this.resolveOptions(config);
    if (!options) return '';
    return html`<span class="ngv-survey-label" .hidden="${!config.label}">
        ${config.label}
        ${config.required ? html`<span style="color: red">*</span>` : ''}
      </span>
      <wa-radio-group
        size="small"
        class="${classMap({'ngv-warning': this.notValid[config.id]})}"
        .value=${this.fieldValues[config.id]}
      >
        ${options.map(
          (option) =>
            html`<wa-radio
              .name="${config.id}"
              .value=${option.value}
              @click=${(evt: Event) => {
                this.fieldValues[config.id] = (<HTMLInputElement>(
                  evt.target
                )).value;
                if (this.notValid[config.id]) {
                  this.notValid = {...this.notValid, [config.id]: false};
                }
                this.requestUpdate();
              }}
              >${option.label}</wa-radio
            >`,
        )}
      </wa-radio-group>`;
  }

  renderReadonly(config: SurveyReadonly | SurveyId): TemplateResult<1> | '' {
    let value: TemplateResult<1> | string = '';
    if (
      config.type === 'readonly' &&
      typeof config.options === 'object' &&
      (config.keyPropId || config.keyCallback)
    ) {
      const options = config.options;
      const key = config.keyPropId || config.keyCallback(this.fieldValues);
      value = options[key];
      this.fieldValues[config.id] = value;
    } else {
      value = <TemplateResult<1> | ''>this.fieldValues[config.id];
    }
    return !this.fieldValues[config.id] || config.hidden
      ? ''
      : html`
          <div>
            <span class="ngv-survey-label"
              >${config.label ? html`${config.label}:` : ''}
            </span>
            <span class="ngv-secondary-text"
              >${until(value, msg('Loading...'))}</span
            >
          </div>
        `;
  }

  renderCoordinates(options: SurveyCoords): TemplateResult<1> | '' {
    // todo make it configurable
    const integerFormat = new Intl.NumberFormat('de-CH', {
      maximumFractionDigits: 3,
    });
    const coordinates = <Coordinates>this.fieldValues[options.id];
    const coordinate = coordinates?.projected
      ? coordinates.projected
      : coordinates?.wgs84;
    if (!coordinate) return '';
    return html`
      <div>
        <span class="ngv-survey-label">${msg('Coordinates')}:</span>
        <span class="ngv-secondary-text">
          ${integerFormat.format(coordinate[0])},
          ${integerFormat.format(coordinate[1])}</span
        >
      </div>
      <div>
        <span class="ngv-survey-label">${msg('Height:')}</span>
        <span class="ngv-secondary-text">
          ${integerFormat.format(coordinate[2])}m</span
        >
      </div>
    `;
  }

  renderFile(options: SurveyFile): TemplateResult<1> | '' {
    return html`${this.fieldValues[options.id]
      ? html`<wa-button
          size="small"
          @click=${() => {
            this.fieldValues[options.id] = '';
            this.requestUpdate();
          }}
        >
          ${msg('Remove attached file')} 🗑
        </wa-button>`
      : html`<ngv-upload
          .options="${{
            accept: options.accept,
            mainBtnText: options.mainBtnText,
            urlInput: options.urlInput,
            urlPlaceholderText: options.urlPlaceholderText,
            fileInput: options.fileInput,
            uploadBtnText: options.uploadBtnText,
          }}"
          @uploaded="${async (evt: {
            detail: FileUploadDetails;
          }): Promise<void> => {
            try {
              this.fieldValues[options.id] = await fileToBase64(
                evt.detail.file,
              );
              this.requestUpdate();
            } catch (e) {
              console.error(e);
            }
          }}"
        ></ngv-upload>`}
    ${this.fieldValues[options.id] && options.accept.includes('image')
      ? html`<img src="${this.fieldValues[options.id]}" alt="preview" />`
      : ''}`;
  }

  renderField(field: SurveyField): TemplateResult<1> | '' {
    switch (field.type) {
      case 'radio':
        return this.renderRadio(field);
      case 'checkbox':
        return this.renderCheckbox(field);
      case 'input':
        return this.renderInput(field);
      case 'color':
        return this.renderColorpicker(field);
      case 'select':
        return this.renderSelect(field);
      case 'textarea':
        return this.renderTextarea(field);
      case 'coordinates':
        return this.renderCoordinates(field);
      case 'file':
        return this.renderFile(field);
      case 'id':
      case 'readonly':
        return this.renderReadonly(field);
      default:
        return '';
    }
  }

  validate(): boolean {
    this.surveyFields.forEach((field) => {
      if (
        field.type !== 'coordinates' &&
        field.type !== 'readonly' &&
        field.type !== 'id' &&
        field.required
      ) {
        const value = this.fieldValues[field.id];
        if (typeof value === 'string') {
          this.notValid[field.id] = !value?.length;
        } else if (typeof value === 'number') {
          this.notValid[field.id] = isNaN(value);
        } else {
          this.notValid[field.id] =
            !value || !Object.values(value).find((v) => v);
        }
      }
    });
    this.requestUpdate();
    return !Object.values(this.notValid).find((v) => v);
  }

  render(): HTMLTemplateResult | string {
    return this.surveyConfigChange.render({
      pending: () => html`<wa-card><progress></progress></wa-card>`,
      error: (error) => {
        console.error(error);
        return html`<wa-card>
          <span class="ngv-secondary-text"
            >${msg('An error occurred when parsing survey')}</span
          >
          <div class="ngv-survey-btns">
            <wa-button
              appearance="filled"
              size="small"
              .hidden=${false}
              @click="${() => {
                this.dispatchEvent(new CustomEvent('cancel'));
              }}"
            >
              <wa-icon name="times"></wa-icon>
            </wa-button>
          </div>
        </wa-card>`;
      },
      complete: () => {
        if (!this.surveyFields || !this.fieldValues) return '';
        return html` <wa-card>
          ${this.surveyFields.map((field) => this.renderField(field))}
          <div class="ngv-survey-btns">
            <wa-button
              appearance="filled"
              size="small"
              .hidden=${false}
              @click="${() => {
                this.dispatchEvent(new CustomEvent('cancel'));
              }}"
            >
              <wa-icon name="times"></wa-icon>
            </wa-button>
            <wa-button
              appearance="filled"
              size="small"
              .hidden=${false}
              @click="${() => {
                const valid = this.validate();
                if (valid) {
                  this.dispatchEvent(
                    new CustomEvent<FieldValues>('confirm', {
                      detail: this.fieldValues,
                    }),
                  );
                }
              }}"
            >
              <wa-icon name="check"></wa-icon>
            </wa-button>
          </div>
        </wa-card>`;
      },
    });
  }

  createRenderRoot(): this {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-survey': NgvSurvey;
  }
}
