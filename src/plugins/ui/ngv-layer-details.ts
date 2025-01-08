import {css, html, LitElement} from 'lit';
import type {HTMLTemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {msg} from '@lit/localize';

export type LayerDetails = {
  name: string;
  type: 'model';
  clippingOptions?: {
    terrainClipping: boolean;
    tilesClipping: boolean;
  };
};

export type ClippingChangeDetail = {
  terrainClipping: boolean;
  tilesClipping: boolean;
};

@customElement('ngv-layer-details')
export class NgvLayerDetails extends LitElement {
  @property({type: Object})
  private layer: LayerDetails;
  @property({type: Boolean})
  private showDone: boolean;
  @property({type: Boolean})
  private showCancel: boolean;

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

  onClippingChange(): void {
    const tilesClipping =
      this.renderRoot.querySelector<HTMLInputElement>(
        '#clipping-tiles',
      ).checked;
    const terrainClipping =
      this.renderRoot.querySelector<HTMLInputElement>(
        '#clipping-terrain',
      ).checked;
    this.dispatchEvent(
      new CustomEvent<ClippingChangeDetail>('clippingChange', {
        detail: {
          tilesClipping,
          terrainClipping,
        },
      }),
    );
  }

  render(): HTMLTemplateResult | string {
    if (!this.layer) return '';
    return html` <div class="info">
      ${this.layer.name}
      ${this.layer.clippingOptions
        ? html` <fieldset>
            <legend>${msg('Clipping:')}</legend>

            <div>
              <input
                type="checkbox"
                id="clipping-tiles"
                name="tiles"
                .checked=${this.layer.clippingOptions.tilesClipping}
                @change=${() => this.onClippingChange()}
              />
              <label for="clipping-tiles">${msg('Clipping 3D tiles')}</label>
            </div>

            <div>
              <input
                type="checkbox"
                id="clipping-terrain"
                name="terrain"
                .checked=${this.layer.clippingOptions.terrainClipping}
                @change=${() => this.onClippingChange()}
              />
              <label for="clipping-terrain">${msg('Clipping terrain')}</label>
            </div>
          </fieldset>`
        : ''}
      <button
        .hidden=${!this.showDone}
        @click="${() => {
          this.dispatchEvent(new CustomEvent('done'));
        }}"
      >
        ${msg('Done')}
      </button>
      <button
        .hidden=${!this.showCancel}
        @click="${() => {
          this.dispatchEvent(new CustomEvent('cancel'));
        }}"
      >
        ${msg('Cancel')}
      </button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-layer-details': NgvLayerDetails;
  }
}
