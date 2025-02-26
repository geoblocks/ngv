import {css, html, LitElement} from 'lit';
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

  static styles = css`
    .list {
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

    .item {
      text-overflow: ellipsis;
      display: flex;
      flex-direction: column;
      column-gap: 10px;
      row-gap: 10px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.16);
      padding-bottom: 10px;
    }

    .item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .item span {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .actions {
      display: flex;
      align-items: center;
      justify-content: end;
      column-gap: 5px;
    }

    button {
      border-radius: 4px;
      padding: 0 16px;
      height: 40px;
      cursor: pointer;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      transition: background-color 200ms;
    }
  `;

  render(): HTMLTemplateResult | string {
    if (!this.layers?.length) return '';
    return html` <p .hidden="${!this.options?.title}">${this.options.title}</p>
      <div class="list">
        ${this.layers.map(
          (l, i) =>
            html`<div class="item">
              <span>${l.name}</span>
              <div class="actions">
                ${this.options?.showZoomBtns
                  ? html`<button
                      @mouseenter=${() =>
                        this.dispatchEvent(
                          new CustomEvent('zoomEnter', {detail: i}),
                        )}
                      @mouseout=${() =>
                        this.dispatchEvent(
                          new CustomEvent('zoomOut', {detail: i}),
                        )}
                      @click=${() => {
                        this.dispatchEvent(
                          new CustomEvent('zoom', {detail: i}),
                        );
                      }}
                    >
                      &#x1F50D;
                    </button>`
                  : ''}
                ${this.options?.showEditBtns
                  ? html`<button
                    @click=${() => {
                      this.dispatchEvent(new CustomEvent('edit', {detail: i}));
                    }}
                  >
                    &#128393
                  </button>`
                  : ''}
                ${this.options?.showDeleteBtns
                  ? html`<button
                      @click=${() => {
                        this.dispatchEvent(
                          new CustomEvent('remove', {detail: i}),
                        );
                      }}
                    >
                      &#x1F5D1;
                    </button>`
                  : ''}
              </div>
            </div>`,
        )}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-layers-list': NgvLayersList;
  }
}
