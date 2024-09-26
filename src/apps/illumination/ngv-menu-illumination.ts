import {html, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {HTMLTemplateResult, PropertyValues} from 'lit';

import '../../plugins/ui/ngv-colored-slider.js';
import type {SliderInputEventData} from '../../plugins/ui/ngv-colored-slider.js';
import {JulianDate} from '@cesium/engine';

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

@customElement('ngv-menu-illumination')
export class NgvMenuIllumination extends LitElement {
  @property({type: Object}) date: Date;
  private dateFrom: Date;

  @state() day: number;
  @state() hour: number;

  updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('date')) {
      this.dateFrom = new Date(this.date.getFullYear(), 0, 1);
      this.day =
        Math.floor(
          (this.date.getTime() - this.dateFrom.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;
      this.hour = this.date.getHours();
    }
  }

  render(): HTMLTemplateResult {
    return html`
      <ngv-colored-slider
        class="hour-slider"
        .title="Time: ${this.hour}"
        .min=${0}
        .max=${23}
        .value="${this.hour}"
        .colorConfig="${{
          side: 'to right',
          colors: [
            {color: '#000033', percentage: [0]},
            {color: '#000033', percentage: [20]},
            {color: '#003366', percentage: [25]},
            {color: '#6699ff', percentage: [33]},
            {color: '#ffffcc', percentage: [66]},
            {color: '#ff9966', percentage: [75]},
            {color: '#cc3300', percentage: [80]},
            {color: '#000033', percentage: [100]},
          ],
        }}"
        @valueChanged="${(evt: CustomEvent<SliderInputEventData>) => {
          this.hour = evt.detail.value;
          this.dispatchChangeEvent();
        }}"
      ></ngv-colored-slider>
      <ngv-colored-slider
        class="day-slider"
        .title="Day: ${this.day}"
        .min=${1}
        .max=${daysInYear(this.date.getFullYear())}
        .value="${this.day}"
        .colorConfig="${{
          side: 'to right',
          colors: [
            {color: '#1843ef', percentage: [8.3]},
            {color: '#96de23', percentage: [33.3]},
            {color: '#d2c801', percentage: [58.3]},
            {color: '#f8700e', percentage: [83.3]},
            {color: '#1843ef', percentage: [100]},
          ],
        }}"
        @valueChanged="${(evt: CustomEvent<SliderInputEventData>) => {
          this.day = evt.detail.value;
          this.dispatchChangeEvent();
        }}"
      ></ngv-colored-slider>
    `;
  }

  dispatchChangeEvent(): void {
    const date = JulianDate.fromDate(this.dateFrom);
    JulianDate.addHours(date, (this.day - 1) * 24 + this.hour, date);

    this.dispatchEvent(new CustomEvent('change', {detail: {date: date}}));
  }
}
