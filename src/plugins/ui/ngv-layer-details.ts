import {html, LitElement} from 'lit';
import type {HTMLTemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {msg} from '@lit/localize';
import {classMap} from 'lit/directives/class-map.js';
import {live} from 'lit/directives/live.js';

export type LayerDetails = {
  name: string;
  type?: 'model';
  clippingOptions?: {
    terrainClipping: boolean;
    tilesClipping: boolean;
  };
  position?: {
    longitude: number;
    latitude: number;
    height: number;
    heading: number;
    pitch: number;
    roll: number;
    scale: number;
  };
};

export type ClippingChangeDetail = {
  terrainClipping?: boolean;
  tilesClipping?: boolean;
};

export type PositionChangeDetail = {
  longitude?: number;
  latitude?: number;
  height?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  scale?: number;
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
          'Model details',
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
        ${this.layer.position
          ? html`<div class="ngv-layer-details-options">
              <wa-input
                label=${msg('Longitude')}
                type="number"
                size="small"
                step="0.000001"
                .value=${live(String(this.layer.position.longitude))}
                @change=${(e: InputEvent) => {
                  const val = parseFloat((<HTMLInputElement>e.target).value);
                  if (!isNaN(val))
                    this.dispatchEvent(
                      new CustomEvent<PositionChangeDetail>('positionChange', {
                        detail: {longitude: val},
                      }),
                    );
                }}
              ></wa-input>
              <wa-input
                label=${msg('Latitude')}
                type="number"
                size="small"
                step="0.000001"
                .value=${live(String(this.layer.position.latitude))}
                @change=${(e: InputEvent) => {
                  const val = parseFloat((<HTMLInputElement>e.target).value);
                  if (!isNaN(val))
                    this.dispatchEvent(
                      new CustomEvent<PositionChangeDetail>('positionChange', {
                        detail: {latitude: val},
                      }),
                    );
                }}
              ></wa-input>
              <wa-input
                label=${msg('Height (m)')}
                type="number"
                size="small"
                step="0.1"
                .value=${live(String(this.layer.position.height))}
                @change=${(e: InputEvent) => {
                  const val = parseFloat((<HTMLInputElement>e.target).value);
                  if (!isNaN(val))
                    this.dispatchEvent(
                      new CustomEvent<PositionChangeDetail>('positionChange', {
                        detail: {height: val},
                      }),
                    );
                }}
              ></wa-input>
              <wa-input
                label=${msg('Heading (°)')}
                type="number"
                size="small"
                step="1"
                .value=${live(String(this.layer.position.heading))}
                @change=${(e: InputEvent) => {
                  const val = parseFloat((<HTMLInputElement>e.target).value);
                  if (!isNaN(val))
                    this.dispatchEvent(
                      new CustomEvent<PositionChangeDetail>('positionChange', {
                        detail: {heading: val},
                      }),
                    );
                }}
              ></wa-input>
              <wa-input
                label=${msg('Pitch (°)')}
                type="number"
                size="small"
                step="1"
                .value=${live(String(this.layer.position.pitch))}
                @change=${(e: InputEvent) => {
                  const val = parseFloat((<HTMLInputElement>e.target).value);
                  if (!isNaN(val))
                    this.dispatchEvent(
                      new CustomEvent<PositionChangeDetail>('positionChange', {
                        detail: {pitch: val},
                      }),
                    );
                }}
              ></wa-input>
              <wa-input
                label=${msg('Roll (°)')}
                type="number"
                size="small"
                step="1"
                .value=${live(String(this.layer.position.roll))}
                @change=${(e: InputEvent) => {
                  const val = parseFloat((<HTMLInputElement>e.target).value);
                  if (!isNaN(val))
                    this.dispatchEvent(
                      new CustomEvent<PositionChangeDetail>('positionChange', {
                        detail: {roll: val},
                      }),
                    );
                }}
              ></wa-input>
              <wa-input
                label=${msg('Scale')}
                type="number"
                size="small"
                step="0.01"
                .value=${live(String(this.layer.position.scale))}
                @change=${(e: InputEvent) => {
                  const val = parseFloat((<HTMLInputElement>e.target).value);
                  if (!isNaN(val))
                    this.dispatchEvent(
                      new CustomEvent<PositionChangeDetail>('positionChange', {
                        detail: {scale: val},
                      }),
                    );
                }}
              ></wa-input>
            </div>`
          : ''}
        <slot name="actions-start"></slot>
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
