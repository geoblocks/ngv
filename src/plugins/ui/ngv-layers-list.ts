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
};

@customElement('ngv-layers-list')
export class NgvLayersList extends LitElement {
  @property({type: Object})
  private layers: LayerListItem[];
  @property({type: Object})
  private options?: LayerListOptions;

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
      align-items: center;
      column-gap: 10px;
    }

    .item span {
      overflow: hidden;
      text-overflow: ellipsis;
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
              ${this.options?.showZoomBtns
                ? html`<button
                    @click=${() => {
                      this.dispatchEvent(new CustomEvent('zoom', {detail: i}));
                    }}
                  >
                    &#x1F50D;
                  </button>`
                : ''}
              <span>${l.name}</span>
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
