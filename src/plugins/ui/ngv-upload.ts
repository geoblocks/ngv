import {customElement, property, query, state} from 'lit/decorators.js';
import type {HTMLTemplateResult} from 'lit';
import {html, LitElement} from 'lit';
import {msg} from '@lit/localize';

export type NgvUploadOptions = {
  accept?: string;
  mainBtnText?: string;
  urlInput?: boolean;
  urlPlaceholderText?: string;
  fileInput?: boolean;
  uploadBtnText?: string;
};

export type FileUploadDetails = {
  url?: string;
  file?: File;
  name: string;
};

@customElement('ngv-upload')
export class NgvUpload extends LitElement {
  @property({type: Object}) options: NgvUploadOptions;
  @state() showPopup = false;
  @state() fileDetails: FileUploadDetails | undefined;
  @query('input[type="file"]') fileInput: HTMLInputElement;

  onFileUpload(file: File): void {
    this.fileDetails = {
      file: file,
      name: file.name,
    };
  }

  upload(): void {
    this.dispatchEvent(
      new CustomEvent<FileUploadDetails>('uploaded', {
        detail: this.fileDetails,
      }),
    );
    this.fileDetails = undefined;
    this.fileInput.value = '';
    this.showPopup = false;
  }

  override willUpdate(): void {
    let options: NgvUploadOptions = {
      mainBtnText: msg('Upload'),
      uploadBtnText: msg('Upload'),
      urlInput: true,
      fileInput: true,
      urlPlaceholderText: msg('Put file URL here'),
      accept: '*/*',
    };
    if (this.options) {
      options = {...options, ...this.options};
    }
    this.options = options;
  }

  render(): HTMLTemplateResult {
    return html` <wa-card>
      ${this.options.fileInput
        ? html`<wa-button
              appearance="filled"
              @click=${() => {
                this.fileInput.click();
              }}
              >${msg('Choose local file')}</wa-button
            >${this.fileDetails?.name
              ? html`<span class="ngv-secondary-text"
                  >${this.fileDetails.name}</span
                >`
              : ''}
            <input
              hidden
              type="file"
              accept="${this.options.accept}"
              @change=${(e: Event) => {
                const target = <HTMLInputElement>e.target;
                if (!target || !target.files?.length) return;
                this.onFileUpload(target.files[0]);
              }}
            />`
        : ''}
      ${this.options.urlInput
        ? html`<wa-input
            type="text"
            placeholder="${this.options.urlPlaceholderText}"
            .value="${this.fileDetails?.url || ''}"
            @input="${(e: InputEvent) => {
              const value = (<HTMLInputElement>e.target).value;
              this.fileDetails = {
                url: value,
                name: value,
              };
            }}"
          ></wa-input>`
        : ''}
      <wa-button appearance="filled" @click="${() => this.upload()}">
        ${this.options.uploadBtnText}
      </wa-button>
    </wa-card>`;
  }

  createRenderRoot(): this {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-upload': NgvUpload;
  }
}
