import {html, LitElement} from 'lit';
import type {HTMLTemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {msg} from '@lit/localize';
import {classMap} from 'lit/directives/class-map.js';

export type LayerDetails = {
  name: string;
  type: 'model';
  clippingOptions?: {
    terrainClipping: boolean;
    tilesClipping: boolean;
  };
};

export type ClippingChangeDetail = {
  terrainClipping?: boolean;
  tilesClipping?: boolean;
};

@customElement('ngv-layer-details')
export class NgvLayerDetails extends LitElement {
  @property({type: Object})
  private layer: LayerDetails;
  @property({type: Boolean})
  private showDone: boolean;
  @property({type: Boolean})
  private showCancel: boolean;

  render(): HTMLTemplateResult | string {
    if (!this.layer) return '';
    return html` <wa-card with-header>
      <div slot="header">
        <wa-icon src="../../../icons/slice.svg"></wa-icon>${msg(
          'Clipping polygons',
        )}
      </div>
      <div class="ngv-layer-details">
        <span class="ngv-layer-details-title">${this.layer.name}</span>
        ${this.layer.clippingOptions
          ? html` <div class="ngv-layer-details-options">
              <wa-checkbox
                ?checked=${!!this.layer.clippingOptions.tilesClipping}
                @change=${(e: InputEvent) =>
                  this.dispatchEvent(
                    new CustomEvent<ClippingChangeDetail>('clippingChange', {
                      detail: {
                        tilesClipping: (<HTMLInputElement>e.target).checked,
                      },
                    }),
                  )}
              >
                ${msg('Clipping 3D tiles')}
              </wa-checkbox>
              <wa-checkbox
                ?checked=${!!this.layer.clippingOptions.terrainClipping}
                @change=${(e: InputEvent) =>
                  this.dispatchEvent(
                    new CustomEvent<ClippingChangeDetail>('clippingChange', {
                      detail: {
                        terrainClipping: (<HTMLInputElement>e.target).checked,
                      },
                    }),
                  )}
              >
                ${msg('Clipping terrain')}
              </wa-checkbox>
            </div>`
          : ''}
        <div class="ngv-layer-details-actions">
          <wa-button
            appearance="filled"
            size="small"
            class="${classMap({
              'wa-visually-hidden': !this.showDone,
            })}"
            @click="${() => {
              this.dispatchEvent(new CustomEvent('done'));
            }}"
          >
            <wa-icon name="check"></wa-icon>
          </wa-button>
          <wa-button
            size="small"
            appearance="filled"
            class="${classMap({
              'wa-visually-hidden': !this.showCancel,
            })}"
            @click="${() => {
              this.dispatchEvent(new CustomEvent('cancel'));
            }}"
          >
            <wa-icon name="times"></wa-icon>
          </wa-button>
        </div>
      </div>
    </wa-card>`;
  }

  createRenderRoot(): this {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-layer-details': NgvLayerDetails;
  }
}
