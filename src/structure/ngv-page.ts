// FIXME: move to a separate package
// FIXME: ability to configure the split panel
import {css, html, LitElement} from 'lit';
import {customElement, query} from 'lit/decorators.js';
import type {HTMLTemplateResult} from 'lit';

@customElement('ngv-page')
export class NgvPage extends LitElement {
  @query('.banner') banner: HTMLElement;
  @query('.header') header: HTMLElement;
  private observer: ResizeObserver;

  static styles = css`
    :host {
      display: block;
      /* box-sizing: border-box; */
      height: 100%;
      width: 100%;
    }

    .base {
      /* min-height: 100%;
        width: 100%; */
      display: grid;
      grid-template-rows: repeat(3, minmax(0, auto)) minmax(0, 1fr) minmax(
          0,
          auto
        );
      grid-template-columns: 100%;
      grid-template-areas:
        'banner'
        'header'
        'body'
        'footer';
    }
    .banner {
      grid-area: banner;
      top: 0;
    }
    .header {
      grid-area: header;
      top: var(--banner-height);
    }
    .banner,
    .header {
      position: sticky;
    }
    .main {
      min-height: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
      grid-template-areas:
        'main-header'
        'main-content'
        'main-footer';
    }
    .menu {
      grid-area: menu;
    }
    .menu {
      position: absolute;
      top: calc(var(--banner-height) + var(--header-height));
      height: calc(100dvh - var(--header-height) - var(--banner-height));
      max-height: calc(100dvh - var(--header-height) - var(--banner-height));
      overflow: auto;
    }
    .main-header {
      grid-area: main-header;
    }
    .main-content {
      grid-area: main-content;
    }
    .main-footer {
      grid-area: main-footer;
    }
    .footer {
      grid-area: footer;
    }
  `;

  render(): HTMLTemplateResult {
    return html`
      <div class="base">
        <div class="banner">
          <slot name="banner"></slot>
        </div>
        <div class="header">
          <slot name="header"></slot>
        </div>
        <div class="body">
          <div class="main">
            <div class="main-header">
              <slot name="main-header"></slot>
            </div>
            <div class="main-content">
              <slot name="main-content"></slot>
            </div>
            <div class="main-footer">
              <slot name="main-footer"></slot>
            </div>
          </div>
        </div>
        <div class="footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }

  firstUpdated(): void {
    // this.observer.observe(this.banner);
    // this.observer.observe(this.header);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer.disconnect();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-page': NgvPage;
  }
}
