import {css, html, LitElement} from 'lit';
import type {HTMLTemplateResult, TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {msg} from '@lit/localize';
import type {
  SurveyCheckbox,
  SurveyCoords,
  SurveyField,
  SurveyFile,
  SurveyId,
  SurveyInput,
  SurveyRadio,
  SurveySelect,
  SurveyTextarea,
} from '../../interfaces/ui/ingv-survey.js';
import {Task} from '@lit/task';
import {classMap} from 'lit/directives/class-map.js';
import './ngv-upload';
import type {FileUploadDetails} from './ngv-upload.js';
import {fileToBase64} from '../../utils/file-utils.js';
import type {Coordinate, FieldValues} from '../../utils/generalTypes.js';

@customElement('ngv-survey')
export class NgvSurvey extends LitElement {
  @property({type: Array})
  public surveyFields: SurveyField[];
  @property({type: Object})
  public fieldValues: FieldValues | undefined;
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
            item.options.forEach((opt) => {
              if (!fields[item.id]) {
                fields[item.id] = {};
              }
              (<Record<string, boolean>>fields[item.id])[opt.value] =
                opt.checked;
            });
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

  renderSelect(options: SurveySelect): TemplateResult<1> | '' {
    return html`<div class="field">
      <label .hidden="${!options.label}"
        >${options.label}
        ${options.required
          ? html`<span style="color: red">*</span>`
          : ''}</label
      >
      <select
        class="${classMap({warning: this.notValid[options.id]})}"
        .required="${options.required}"
        @change=${(evt: Event) => {
          this.fieldValues[options.id] = (<HTMLSelectElement>evt.target).value;
          if (this.notValid[options.id]) {
            this.notValid = {...this.notValid, [options.id]: false};
          }
        }}
      >
        ${options.defaultValue
          ? ''
          : html`<option value="" disabled selected>
              ${msg('Select an option')}
            </option>`}
        ${options.options.map(
          (option) =>
            html`<option
              .value="${option.value}"
              .selected="${option.value === this.fieldValues[options.id]}"
            >
              ${option.label}
            </option>`,
        )}
      </select>
    </div>`;
  }

  renderCheckbox(options: SurveyCheckbox): TemplateResult<1> | '' {
    const checkbox = (option: SurveyCheckbox['options'][number]) =>
      html`<div
        class="line-field ${classMap({
          warning: this.notValid[options.id] && options.options?.length === 1,
        })}"
      >
        <label>${option.label}</label>
        <input
          type="checkbox"
          .checked=${(<Record<string, boolean>>this.fieldValues[options.id])[
            option.value
          ]}
          @click=${(evt: Event) => {
            if (!this.fieldValues[options.id]) {
              this.fieldValues[options.id] = {};
            }
            (<Record<string, boolean>>this.fieldValues[options.id])[
              option.value
            ] = (<HTMLInputElement>evt.target).checked;
            if (this.notValid[options.id]) {
              this.notValid = {...this.notValid, [options.id]: false};
            }
          }}
        />
      </div>`;
    return options.options?.length > 1
      ? html` <fieldset
          class="${classMap({warning: this.notValid[options.id]})}"
        >
          <legend .hidden="${!options.label}">
            ${options.label}
            ${options.required ? html`<span style="color: red">*</span>` : ''}
          </legend>
          ${options.options.map(checkbox)}
        </fieldset>`
      : checkbox(options.options[0]);
  }

  renderRadio(options: SurveyRadio): TemplateResult<1> | '' {
    return html` <fieldset
      class="${classMap({warning: this.notValid[options.id]})}"
    >
      <legend .hidden="${!options.label}">
        ${options.label}
        ${options.required ? html`<span style="color: red">*</span>` : ''}
      </legend>
      ${options.options.map(
        (option) =>
          html`<div class="line-field">
            <label>${option.label}</label>
            <input
              type="radio"
              .name="${options.id}"
              .checked="${option.value === this.fieldValues[options.id]}"
              .value=${option.value}
              @click=${(evt: Event) => {
                this.fieldValues[options.id] = (<HTMLInputElement>(
                  evt.target
                )).value;
                if (this.notValid[options.id]) {
                  this.notValid = {...this.notValid, [options.id]: false};
                }
              }}
            />
          </div>`,
      )}
    </fieldset>`;
  }

  renderId(options: SurveyId): TemplateResult<1> | '' {
    return html`
      <div class="field" style="font-size: small">
        <span><b>${msg('ID')}: </b>${this.fieldValues[options.id]}</span>
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
        return this.renderId(field);
      default:
        return '';
    }
  }

  validate(): boolean {
    this.surveyFields.forEach((field) => {
      if (
        field.type !== 'coordinates' &&
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
    console.log('xxx', this.surveyFields);
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
