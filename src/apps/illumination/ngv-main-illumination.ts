import {customElement, property, state} from 'lit/decorators.js';
import type {HTMLTemplateResult} from 'lit';
import {css, html, LitElement} from 'lit';
import {type CesiumWidget, JulianDate} from '@cesium/engine';
import type {IIlluminationConfig} from './ingv-config-illumination.js';

import '../../plugins/cesium/ngv-plugin-cesium-widget.js';
import '../../plugins/ui/ngv-colored-slider.js';
import type {SliderInputEventData} from '../../plugins/ui/ngv-colored-slider.js';

const YEAR = new Date().getFullYear();
const BASE_DATE = new Date(`${YEAR}-01-01T00:00:00`);
const BASE_JULIAN_DATE = JulianDate.fromDate(BASE_DATE);

@customElement('ngv-main-illumination')
export class NgvMainIllumination extends LitElement {
  @state()
  day: number = 1;
  @state()
  hour: number = 12;

  private viewer: CesiumWidget;

  @property({type: Object})
  config: IIlluminationConfig['app'];

  static styles = css`
    .app-container {
      margin-top: 10px;
      width: 100%;
    }

    ngv-plugin-cesium-widget {
      width: 100%;
      height: calc(100vh - 320px);
      padding: 10px 0;
    }

    .controls {
      position: absolute;
      display: flex;
      flex-direction: row;
      width: 95%;
      margin-top: 10px;
      padding: 10px;
      column-gap: 10px;
      background: rgba(0, 0, 0, 0.3);
      color: white;
      z-index: 1000;
    }

    ngv-colored-slider {
      width: 100%;
    }
  `;

  // FIXME: extract slider to own component

  protected render(): HTMLTemplateResult {
    return html`
      <div class="app-container">
        <label class="year-label">Year: ${YEAR}</label>
        <div class="controls">
          <ngv-colored-slider
            class="hour-slider"
            .title="Time: ${this.time}"
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
              this.updateDayAndHour();
            }}"
          ></ngv-colored-slider>
          <ngv-colored-slider
            class="day-slider"
            .title="Day: ${this.date}"
            .min=${1}
            .max="${this.daysInYear}"
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
            @valueChanged="${(value: CustomEvent<SliderInputEventData>) => {
              this.day = value.detail.value;
              this.updateDayAndHour();
            }}"
          ></ngv-colored-slider>
        </div>
        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.cesiumContext}
          @viewerInitialized=${(evt: CustomEvent<CesiumWidget>) => {
            this.viewer = evt.detail;
            this.updateDayAndHour();
          }}
        ></ngv-plugin-cesium-widget>
      </div>
    `;
  }

  get time(): string {
    BASE_DATE.setHours(this.hour);
    return BASE_DATE.toLocaleTimeString();
  }

  get date(): string {
    BASE_DATE.setMonth(0);
    BASE_DATE.setDate(this.day);
    const day = BASE_DATE.getDate();
    const monthName = BASE_DATE.toLocaleString('default', {month: 'long'});
    return `${day} of ${monthName} (day ${this.day})`;
  }

  updateDayAndHour(): void {
    JulianDate.addHours(
      BASE_JULIAN_DATE,
      (this.day - 1) * 24 + this.hour,
      this.viewer.clock.currentTime,
    );
  }

  get daysInYear(): number {
    return (YEAR % 4 === 0 && YEAR % 100 !== 0) || YEAR % 400 === 0 ? 366 : 365;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-main-illumination': NgvMainIllumination;
  }
}
