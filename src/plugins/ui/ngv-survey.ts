import {css, html, LitElement} from 'lit';
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
} from '../../interfaces/ui/ingv-survey.js';
import {Task} from '@lit/task';
import {classMap} from 'lit/directives/class-map.js';
import './ngv-upload';
import type {FileUploadDetails} from './ngv-upload.js';
import {fileToBase64} from '../../utils/file-utils.js';
import type {Coordinate, FieldValues} from '../../utils/generalTypes.js';
import {until} from 'lit/directives/until.js';
import proj4 from 'proj4';

@customElement('ngv-survey')
export class NgvSurvey extends LitElement {
  @property({type: Array})
  public surveyFields: SurveyField[];
  @property({type: Object})
  public fieldValues: FieldValues | undefined;
  @property({type: String})
  public projection: string;
  @state()
  notValid: Record<string, boolean> = {};

  static styles = css`
    .survey {
      background-color: white;
      display: flex;
      flex-direction: column;
      z-index: 1;
      margin-left: auto;
      margin-right: auto;
      padding: 10px;
      gap: 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
    }

    .field {
      display: flex;
      flex-direction: column;
    }

    .btns-container {
      display: flex;
      justify-content: end;
      column-gap: 16px;
    }

    .line-field {
      display: flex;
      column-gap: 12px;
      align-content: center;
    }

    button,
    textarea,
    select,
    input[type='number'],
    input[type='date'],
    input[type='text'] {
      border-radius: 4px;
      padding: 0 12px;
      height: 40px;
      cursor: pointer;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      transition: background-color 200ms;
    }

    textarea {
      padding: 12px;
    }

    input[type='text'] {
      cursor: text;
    }

    .warning {
      border: 1px solid orangered !important;
    }
  `;

  // @ts-expect-error TS6133
  private _surveyConfigChange = new Task(this, {
    args: (): [SurveyField[]] => [this.surveyFields],
    task: ([surveyConfig]) => {
      const fields: Record<string, any> = {...this.fieldValues};
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
        if (item.type === 'coordinates' && this.projection?.length) {
          const coords = <Coordinate>fields[item.id];
          const projected = proj4('EPSG:4326', this.projection, [
            coords.longitude,
            coords.latitude,
          ]);
          fields[item.id] = <Coordinate>{
            ...fields[item.id],
            longitude: projected[0],
            latitude: projected[1],
          };
        }
      });
      this.fieldValues = {...fields};
    },
  });

  renderInput(options: SurveyInput): TemplateResult<1> | '' {
    const isText = options.inputType === 'text';
    return html`
      <div class="field">
        <label .hidden="${!options.label?.length}"
          >${options.label}
          ${options.required
            ? html`<span style="color: red">*</span>`
            : ''}</label
        >
        <input
          class="${classMap({warning: this.notValid[options.id]})}"
          .type="${options.inputType}"
          .placeholder="${options.placeholder || ''}"
          .value="${this.fieldValues[options.id] || ''}"
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
    return html` <div class="field">
      <label .hidden="${!options.label?.length}"
        >${options.label}
        ${options.required
          ? html`<span style="color: red">*</span>`
          : ''}</label
      >
      <textarea
        class="${classMap({warning: this.notValid[options.id]})}"
        .placeholder="${options.placeholder || ''}"
        .minlength="${options.min}"
        .maxlength="${options.max}"
        .required="${options.required}"
        @input=${(evt: Event) => {
          this.fieldValues[options.id] = (<HTMLInputElement>evt.target).value;
          if (this.notValid[options.id]) {
            this.notValid = {...this.notValid, [options.id]: false};
          }
        }}
      >
${this.fieldValues[options.id] || ''}</textarea
      >
    </div>`;
  }

  resolveOptions(
    config: SurveyRadio | SurveyCheckbox | SurveySelect,
  ): LabelValue[] | undefined {
    // options resolved in index.ts, resolveFieldsConfig
    let options = <FieldOptions>config.options;
    if (!Array.isArray(options) && (config.keyPropId || config.keyCallback)) {
      const key = <string>(
        this.fieldValues[
          config.keyPropId || config.keyCallback(this.fieldValues)
        ]
      );
      options = options[key];
    }
    if (Array.isArray(options) && options?.length) return options;
    else return undefined;
  }

  renderSelect(config: SurveySelect): TemplateResult<1> | '' {
    const options = this.resolveOptions(config);
    if (!options) return '';
    return html`<div class="field">
      <label .hidden="${!config.label}"
        >${config.label}
        ${config.required ? html`<span style="color: red">*</span>` : ''}</label
      >
      <select
        class="${classMap({warning: this.notValid[config.id]})}"
        .required="${config.required}"
        @change=${(evt: Event) => {
          this.fieldValues[config.id] = (<HTMLSelectElement>evt.target).value;
          if (this.notValid[config.id]) {
            this.notValid = {...this.notValid, [config.id]: false};
          }
          this.requestUpdate();
        }}
      >
        ${config.defaultValue
          ? ''
          : html`<option value="" disabled selected>
              ${msg('Select an option')}
            </option>`}
        ${options.map(
          (option) =>
            html`<option
              .value="${option.value}"
              .selected="${option.value === this.fieldValues[config.id]}"
            >
              ${option.label}
            </option>`,
        )}
      </select>
    </div>`;
  }

  renderCheckbox(config: SurveyCheckbox): TemplateResult<1> | '' {
    const options = this.resolveOptions(config);
    if (!options) return '';
    const checkbox = (option: LabelValue) =>
      html`<div
        class="line-field ${classMap({
          warning: this.notValid[config.id] && config.options?.length === 1,
        })}"
      >
        <label>${option.label}</label>
        <input
          type="checkbox"
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
        />
      </div>`;
    return html`${options?.length > 1
      ? html` <fieldset
          class="${classMap({warning: this.notValid[config.id]})}"
        >
          <legend .hidden="${!config.label}">
            ${config.label}
            ${config.required ? html`<span style="color: red">*</span>` : ''}
          </legend>
          ${options.map(checkbox)}
        </fieldset>`
      : checkbox(options[0])}`;
  }

  renderRadio(config: SurveyRadio): TemplateResult<1> | '' {
    const options = this.resolveOptions(config);
    if (!options) return '';
    return html` <fieldset
      class="${classMap({warning: this.notValid[config.id]})}"
    >
      <legend .hidden="${!config.label}">
        ${config.label}
        ${config.required ? html`<span style="color: red">*</span>` : ''}
      </legend>
      ${options.map(
        (option) =>
          html`<div class="line-field">
            <label>${option.label}</label>
            <input
              type="radio"
              .name="${config.id}"
              .checked="${option.value === this.fieldValues[config.id]}"
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
            />
          </div>`,
      )}
    </fieldset>`;
  }

  promiseRenderWrap(
    render: () => Promise<TemplateResult<1> | ''>,
  ): TemplateResult<1> | '' {
    return html`${until(
      render(),
      html`<div class="line-field">${msg('Loading...')}</div>`,
    )}`;
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
      this.fieldValues[config.id] = key;
    } else {
      value = <TemplateResult<1> | ''>this.fieldValues[config.id];
    }
    return !this.fieldValues[config.id]
      ? ''
      : html`
          <div class="field" style="font-size: small">
            <span
              ><b>${msg(config.label)}: </b>${until(
                value,
                msg('Loading...'),
              )}</span
            >
          </div>
        `;
  }

  renderCoordinates(options: SurveyCoords): TemplateResult<1> | '' {
    const coordinate = <Coordinate>this.fieldValues[options.id];
    return html`
      <div class="field" style="font-size: smaller">
        <span
          ><b>${msg('Coordinates')}: </b><br />${coordinate.longitude},
          ${coordinate.latitude}<br /><b>${msg('Height:')}</b>
          ${coordinate.height}m</span
        >
      </div>
    `;
  }

  renderFile(options: SurveyFile): TemplateResult<1> | '' {
    return html`${this.fieldValues[options.id]
      ? html`<button
          @click=${() => {
            this.fieldValues[options.id] = '';
            this.requestUpdate();
          }}
        >
          ${msg('Remove attached file')} 🗑
        </button>`
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
    if (!this.surveyFields || !this.fieldValues) return '';
    return html` <div class="survey">
      ${this.surveyFields.map((field) => this.renderField(field))}
      <div class="btns-container">
        <button
          .hidden=${false}
          @click="${() => {
            this.dispatchEvent(new CustomEvent('cancel'));
          }}"
        >
          ${msg('Cancel')}
        </button>
        <button
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
          ${msg('Confirm')}
        </button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-survey': NgvSurvey;
  }
}
