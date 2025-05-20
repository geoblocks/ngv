import {customElement} from 'lit/decorators.js';
import {css, html, type HTMLTemplateResult, LitElement} from 'lit';
@customElement('ngv-structure-overlay')
export class NgvStructureOverlay extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      z-index: 1;
    }
    .top-left,
    .top-right,
    .menu-left,
    .bottom-left,
    .bottom-right,
    .on-map {
      position: absolute;
    }

    .menu-left {
      top: 150px;
      left: 20px;
    }
  `;
  render(): HTMLTemplateResult {
    return html`
      <div class="top-left"><slot name="top-left"></slot></div>
      <div class="top-right">
        <slot name="top-right"></slot>
      </div>
      <div class="menu-left"><slot name="menu-left"></slot></div>
      <div class="bottom-left"><slot name="bottom-left"></slot></div>
      <div class="bottom-right"><slot name="bottom-right"></slot></div>
      <div class="on-map"><slot></slot></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-structure-overlay': NgvStructureOverlay;
  }
}
