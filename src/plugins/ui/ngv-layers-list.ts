import {html, LitElement} from 'lit';
import type {HTMLTemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';

export type LayerListItem = {
  name: string;
};

export type LayerListOptions = {
  title?: string;
  showDeleteBtns?: boolean;
  showZoomBtns?: boolean;
  showEditBtns?: boolean;
};

@customElement('ngv-layers-list')
export class NgvLayersList extends LitElement {
  @property({type: Array})
  layers: LayerListItem[];
  @property({type: Object})
  options?: LayerListOptions;

  render(): HTMLTemplateResult | string {
    if (!this.layers?.length) return '';
    return html` <p .hidden="${!this.options?.title}">${this.options.title}</p>
      <div class="ngv-layers-list">
        ${this.layers.map(
          (l, i) =>
            html`<div class="ngv-layers-list-item">
              ${this.options?.showZoomBtns
                ? html`<wa-icon-button
                    src="../../../icons/recenter.svg"
                    size="small"
                    @mouseenter=${() =>
                      this.dispatchEvent(
                        new CustomEvent('zoomEnter', {detail: i}),
                      )}
                    @mouseout=${() =>
                      this.dispatchEvent(
                        new CustomEvent('zoomOut', {detail: i}),
                      )}
                    @click=${() => {
                      this.dispatchEvent(new CustomEvent('zoom', {detail: i}));
                    }}
                  >
                  </wa-icon-button>`
                : ''}
              <span class="ngv-layers-list-title">${l.name}</span>
              <div class="ngv-layers-list-item-actions">
                ${this.options?.showEditBtns
                  ? html`<wa-icon-button
                    name="pencil"
                    size="small"
                    @click=${() => {
                      this.dispatchEvent(new CustomEvent('edit', {detail: i}));
                    }}
                  >
                    &#128393
                  </wa-icon-button>`
                  : ''}
                ${this.options?.showDeleteBtns
                  ? html`<wa-icon-button
                      src="../../../icons/trash.svg"
                      size="small"
                      @click=${() => {
                        this.dispatchEvent(
                          new CustomEvent('remove', {detail: i}),
                        );
                      }}
                    >
                    </wa-icon-button>`
                  : ''}
              </div>
            </div>`,
        )}
      </div>`;
  }
  createRenderRoot(): this {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-layers-list': NgvLayersList;
  }
}
