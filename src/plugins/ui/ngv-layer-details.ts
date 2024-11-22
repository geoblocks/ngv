import {css, html, LitElement} from 'lit';
import type {HTMLTemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';

export type LayerDetails = {
  name: string;
};

@customElement('ngv-layer-details')
export class NgvLayerDetails extends LitElement {
  @property({type: Object})
  private layer: LayerDetails;

  static styles = css`
    .info {
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

    button,
    input[type='text'] {
      border-radius: 4px;
      padding: 0 16px;
      height: 40px;
      cursor: pointer;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      transition: background-color 200ms;
    }

    input[type='text'] {
      cursor: text;
    }
  `;

  render(): HTMLTemplateResult | string {
    if (!this.layer) return '';
    return html` <div class="info">
      ${this.layer.name}
      <button
        @click="${() => {
          this.dispatchEvent(new CustomEvent('done'));
        }}"
      >
        Done
      </button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-layer-details': NgvLayerDetails;
  }
}
