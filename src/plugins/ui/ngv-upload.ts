import {customElement, property, query, state} from 'lit/decorators.js';
import type {HTMLTemplateResult} from 'lit';
import {css, html, LitElement} from 'lit';

export type NgvUploadOptions = {
  accept?: string;
  mainBtnText?: string;
  urlInput?: boolean;
  urlPlaceholderText?: string;
  fileInput?: boolean;
  uploadBtnText?: string;
};

const defaultOptions: NgvUploadOptions = {
  mainBtnText: 'Upload',
  uploadBtnText: 'Upload',
  urlInput: true,
  fileInput: true,
  urlPlaceholderText: 'Put file URL here',
  accept: '*/*',
};

export type FileUploadDetails = {
  url: string;
  name: string;
};

/**
 * TODO
 *  * type check
 *  * error handling
 *  * multiple files upload
 *  * drag & drop ?
 *  * URL input
 */
@customElement('ngv-upload')
export class NgvUpload extends LitElement {
  @property({type: Object}) options: NgvUploadOptions;
  @state() showPopup = false;
  @state() fileDetails: FileUploadDetails | undefined;
  @query('input[type="file"]') fileInput: HTMLInputElement;

  static styles = css`
    .upload-popup {
      background-color: white;
      display: flex;
      flex-direction: column;
      margin-left: auto;
      margin-right: auto;
      padding: 10px;
      gap: 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
    }

    button,
    input[type='text'],
    input[type='file']::file-selector-button {
      border-radius: 4px;
      padding: 0 16px;
      height: 40px;
      cursor: pointer;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      margin-right: 16px;
      transition: background-color 200ms;
    }

    input[type='text'] {
      cursor: text;
    }

    input[type='file'] {
      background-color: #f3f4f6;
      cursor: pointer;
    }

    input[type='file']::file-selector-button:active {
      background-color: #e5e7eb;
    }
  `;

  async onFileUpload(file: File): Promise<void> {
    const arrayBufer = await file.arrayBuffer();
    const blob = new Blob([arrayBufer]);
    this.fileDetails = {
      url: URL.createObjectURL(blob),
      name: file.name,
    };
  }

  upload(): void {
    this.dispatchEvent(
      new CustomEvent<FileUploadDetails>('uploaded', {
        detail: this.fileDetails,
      }),
    );
    this.fileInput.value = '';
    this.showPopup = false;
  }

  override willUpdate(): void {
    const options: NgvUploadOptions = {...defaultOptions};
    if (this.options) {
      Object.keys((key: keyof NgvUploadOptions) => {
        if (this.options[key] !== undefined && this.options[key] !== null) {
          options[key] = this.options[key];
        }
      });
    }
    this.options = options;
  }

  render(): HTMLTemplateResult {
    return html` <div class="upload-popup">
      <input
        type="file"
        accept="${this.options.accept}"
        @change=${async (e: Event) => {
          const target = <HTMLInputElement>e.target;
          if (!target || !target.files?.length) return;
          await this.onFileUpload(target.files[0]);
        }}
      />
      <!-- <input
            type="text"
            placeholder="${this.options.urlPlaceholderText}"
            .value="${this.fileDetails}"
            @input="${(e: InputEvent) => {}}"
          /> -->
      <button @click="${() => this.upload()}">
        ${this.options.uploadBtnText}
      </button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-upload': NgvUpload;
  }
}