import {customElement, property, query} from 'lit/decorators.js';
import type {HTMLTemplateResult} from 'lit';
import {css, html, LitElement} from 'lit';
import type {Properties} from 'csstype';

export type SliderInputEventData = {
  value: number;
};

export type SliderColorConfig = {
  side: 'to right' | 'to left';
  colors: {
    color: Properties['color'];
    percentage: [number] | [number, number];
  }[];
};

@customElement('ngv-colored-slider')
export class NgvColoredSlider extends LitElement {
  @property({type: Number}) min: number;
  @property({type: Number}) max: number;
  @property({type: Number}) value: number;
  @property({type: Number}) step: number = 1;
  @property({type: String}) title: string | undefined;
  @property({type: Object}) colorConfig: SliderColorConfig;
  @query('input') input: HTMLInputElement;

  static styles = css`
    .slider-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      width: 100%;
      gap: 7px;
    }

    .slider-container label {
      white-space: nowrap;
      width: 100px;
    }

    .slider-container input {
      -webkit-appearance: none;
      width: 100%;
      height: 10px;
    }

    .slider-container input::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 22px;
      border: 0;
      background: red;
      cursor: pointer;
    }

    .slider-container input::-moz-range-thumb {
      width: 12px;
      height: 22px;
      border: 0;
      background: red;
      cursor: pointer;
    }
  `;

  public override render(): HTMLTemplateResult {
    return html`
      <div class="slider-container">
        <input
          type="range"
          min="${this.min}"
          max="${this.max}"
          step="${this.step}"
          value="${this.value}"
          @input="${() => {
            this.value = this.input.valueAsNumber;
            this.dispatchEvent(
              new CustomEvent<SliderInputEventData>('valueChanged', {
                detail: {value: this.value},
              }),
            );
          }}"
          style="background-image: linear-gradient(${this.colorConfig
            .side}, ${this.colorConfig.colors
            .map(
              (c) => `${c.color} ${c.percentage.map((p) => `${p}%`).join(' ')}`,
            )
            .join(', ')})"
        />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-colored-slider': NgvColoredSlider;
  }
}
