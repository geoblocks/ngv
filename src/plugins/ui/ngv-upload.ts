import {customElement, property, query, state} from 'lit/decorators.js';
import type {HTMLTemplateResult} from 'lit';
import {css, html, LitElement} from 'lit';
import {classMap} from 'lit/directives/class-map.js';

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
  @state() fileUrl: string | undefined;
  @query('input[type="file"]') fileInput: HTMLInputElement;

  static styles = css`
    .main-btn {
      margin: 10px;
    }

    .upload-container {
      width: 100vw;
      height: 100vh;
      top: 0;
      left: 0;
      z-index: 1;
      position: absolute;
    }

    .upload-container.hidden {
      display: none;
    }

    .upload-backdrop {
      background-color: black;
      opacity: 50%;
      position: absolute;
      width: 100%;
      height: 100%;
    }

    .upload-popup {
      position: absolute;
      background-color: white;
      display: flex;
      flex-direction: column;
      z-index: 2;
      margin-left: auto;
      margin-right: auto;
      top: 10%;
      left: 50%;
      transform: translate(-50%, -10%);
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
    this.fileUrl = URL.createObjectURL(blob);
  }

  upload(): void {
    this.dispatchEvent(
      new CustomEvent<string>('uploaded', {detail: this.fileUrl}),
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
    return html`<button
        class="main-btn"
        @click="${() => (this.showPopup = true)}"
      >
        ${this.options.mainBtnText}
      </button>
      <div class="upload-container ${classMap({hidden: !this.showPopup})}">
        <div class="upload-popup">
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
            .value="${this.fileUrl}"
            @input="${(e: InputEvent) => {}}"
          /> -->
          <button @click="${() => this.upload()}">
            ${this.options.uploadBtnText}
          </button>
        </div>
        <div
          class="upload-backdrop"
          @click="${() => (this.showPopup = false)}"
        ></div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-upload': NgvUpload;
  }
}
