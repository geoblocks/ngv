import type {HTMLTemplateResult} from 'lit';
import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

export type Status = 'loading' | 'error' | 'ready' | undefined;

@customElement('ngv-structure-apploading')
export class NgvStructureAppLoading extends LitElement {
  @property({type: String})
  config: Status;

  @property({type: String})
  language: Status;

  renderItem(status: Status): string {
    switch (status) {
      case 'error':
        return '⨯';
      case 'loading':
        return '…';
      case 'ready':
        return '✓';
      default:
        return '';
    }
  }

  render(): HTMLTemplateResult {
    return html`Loading...<br />
      - ${this.renderItem(this.config)} config<br />
      - ${this.renderItem(this.language)} lang<br /> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-structure-apploading': NgvStructureAppLoading;
  }
}
