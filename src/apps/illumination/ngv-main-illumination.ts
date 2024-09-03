import {customElement, property, query, state} from 'lit/decorators.js';
import {css, html, LitElement} from 'lit';
import {type CesiumWidget, JulianDate} from '@cesium/engine';
import {IIlluminationConfig} from './ingv-config-illumination.js';

import '../../plugins/cesium/ngv-plugin-cesium-widget.js';

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

  @query('.hour-slider')
  hourSlider: HTMLInputElement;
  @query('.day-slider')
  daySlider: HTMLInputElement;

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

    .slider-container {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .day-slider {
      background-image: linear-gradient(
        to right,
        #1843ef 8.3%,
        #96de23 33.3%,
        #d2c801 58.3%,
        #f8700e 83.3%,
        #1843ef 100%
      );
      //background-image: linear-gradient(to left, #1893EF 8.3%, #f8700e 8.3% 33.3%, #d2c801 33.3% 58.3%, #96de23 58.3% 83.3%, #1893EF 83.3% 100%)
    }

    .hour-slider {
      background-image: linear-gradient(
        to right,
        #000033 0%,
        /* 00:00 Night */ #000033 20%,
        /* 05:00 */ #003366 25%,
        /* 06:00 Dawn */ #6699ff 33%,
        /* 09:00 Day */ #ffffcc 66%,
        /* 16:00 Peak Daylight */ #ff9966 75%,
        /* 17:00 Dusk */ #cc3300 80%,
        /* 19:00 */ #000033 100% /* 23:00 Night */
      );
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

  // FIXME: extract slider to own component

  protected render() {
    return html`
      <div class="app-container">
        <label class="year-label">Year: ${YEAR}</label>
        <div class="controls">
          <div class="slider-container">
            <label>Time: ${this.time}</label>
            <input
              type="range"
              class="hour-slider"
              min="0"
              max="23"
              step="1"
              value="${this.hour}"
              @input="${() => this.updateDayAndHour()}"
            />
          </div>
          <div class="slider-container">
            <label>Day: ${this.date}</label>
            <input
              type="range"
              class="day-slider"
              min="1"
              max="${this.daysInYear}"
              step="1"
              value="${this.day}"
              @input="${() => this.updateDayAndHour()}"
            />
          </div>
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

  get time() {
    BASE_DATE.setHours(this.hour);
    return BASE_DATE.toLocaleTimeString();
  }

  get date() {
    BASE_DATE.setMonth(0);
    BASE_DATE.setDate(this.day);
    const day = BASE_DATE.getDate();
    const monthName = BASE_DATE.toLocaleString('default', {month: 'long'});
    return `${day} of ${monthName} (day ${this.day})`;
  }

  updateDayAndHour() {
    this.hour = parseInt(this.hourSlider.value);
    this.day = parseInt(this.daySlider.value);
    JulianDate.addHours(
      BASE_JULIAN_DATE,
      (this.day - 1) * 24 + this.hour,
      this.viewer.clock.currentTime,
    );
  }

  get daysInYear() {
    return (YEAR % 4 === 0 && YEAR % 100 !== 0) || YEAR % 400 === 0 ? 366 : 365;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-main-illumination': NgvMainIllumination;
  }
}
