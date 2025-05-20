import {customElement, property, state} from 'lit/decorators.js';
import {html, type HTMLTemplateResult, LitElement} from 'lit';
import {msg} from '@lit/localize';
import type {CesiumWidget, DataSourceCollection, Entity} from '@cesium/engine';
import {Color, CustomDataSource, HeightReference} from '@cesium/engine';
import type {DrawInfo} from './draw.js';
import {CesiumDraw, type DrawEndDetails, getDimensionLabel} from './draw.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import {classMap} from 'lit/directives/class-map.js';

const DefaultConfig: IngvCesiumContext['measureOptions'] = {
  areaFill: 'rgba(0, 153, 255, 0.3)',
  lineColor: 'rgba(0, 153, 255, 0.75)',
  lineWidth: 4,
  showPoints: true,
  pointColor: '#fff',
  pointOutlineWidth: 1,
  pointOutlineColor: '#000',
  pointPixelSize: 5,
};

@customElement('ngv-plugin-cesium-measure')
export class NgvPluginCesiumMeasure extends LitElement {
  @property({type: Object})
  private viewer: CesiumWidget;
  @property({type: Object})
  private dataSourceCollection: DataSourceCollection;
  @property({type: Object})
  private options: IngvCesiumContext['measureOptions'];
  @state()
  private measurements: Partial<DrawInfo>;
  private draw: CesiumDraw;
  private measureDataSource: CustomDataSource = new CustomDataSource();
  private drawDataSource: CustomDataSource = new CustomDataSource();

  firstUpdated(): void {
    this.dataSourceCollection
      .add(this.measureDataSource)
      .catch((e) => console.error(e));
    this.dataSourceCollection
      .add(this.drawDataSource)
      .then((drawDataSource) => {
        this.draw = new CesiumDraw(this.viewer, drawDataSource, {
          lineClampToGround: false,
          strokeColor: this.options?.lineColor || DefaultConfig.lineColor,
          fillColor: this.options?.areaFill || DefaultConfig.areaFill,
          strokeWidth: this.options?.lineWidth || DefaultConfig.lineWidth,
          pointOptions: {
            heightReference: HeightReference.NONE,
            color: this.options?.pointColor || DefaultConfig.pointColor,
            outlineColor:
              this.options?.pointOutlineColor ||
              DefaultConfig.pointOutlineColor,
            outlineWidth:
              typeof this.options?.pointOutlineWidth === 'number'
                ? this.options?.pointOutlineWidth
                : DefaultConfig.pointOutlineWidth,
            pixelSizeDefault:
              this.options?.pointPixelSize || DefaultConfig.pointPixelSize,
          },
        });
        this.draw.addEventListener('drawend', (e) => {
          const details = (<CustomEvent<DrawEndDetails>>e).detail;
          if (details.type === 'line') {
            this.measureDataSource.entities.add({
              polyline: {
                positions: details.positions,
                material: Color.fromCssColorString(
                  this.options?.lineColor || DefaultConfig.lineColor,
                ),
                width: this.options?.lineWidth || DefaultConfig.lineWidth,
              },
            });
          } else {
            this.measureDataSource.entities.add({
              polygon: {
                hierarchy: details.positions,
                material: Color.fromCssColorString(
                  this.options?.lineColor || DefaultConfig.lineColor,
                ),
                perPositionHeight: true,
              },
            });
          }
          if (
            (typeof this.options?.showPoints === 'boolean' &&
              this.options.showPoints) ||
            DefaultConfig.showPoints
          ) {
            details.positions.forEach((p, index) => {
              const entity: Entity.ConstructorOptions = {
                position: p,
                point: {
                  color: Color.fromCssColorString(
                    this.options?.pointColor || DefaultConfig.pointColor,
                  ),
                  outlineWidth:
                    typeof this.options?.pointOutlineWidth === 'number'
                      ? this.options?.pointOutlineWidth
                      : DefaultConfig.pointOutlineWidth,
                  outlineColor: Color.fromCssColorString(
                    this.options?.pointOutlineColor ||
                      DefaultConfig.pointOutlineColor,
                  ),
                  pixelSize:
                    this.options?.pointPixelSize ||
                    DefaultConfig.pointPixelSize,
                  heightReference: HeightReference.NONE,
                },
              };
              if (index === details.positions.length - 1) {
                entity.label = getDimensionLabel({
                  type: details.type,
                  positions: details.positions,
                  distances: details.measurements.segmentsLength,
                });
              }
              this.measureDataSource.entities.add(entity);
            });
          } else {
            this.measureDataSource.entities.add({
              position: details.positions[details.positions.length - 1],
              label: getDimensionLabel({
                type: details.type,
                positions: details.positions,
                distances: details.measurements.segmentsLength,
              }),
            });
          }
          this.draw.active = false;
        });
        this.draw.addEventListener('drawinfo', (e) => {
          const details = (<CustomEvent<DrawInfo>>e).detail;
          this.measurements = {
            length: details.segments.reduce((a, s) => s.length + a, 0),
            type: details.type,
            numberOfSegments: details.numberOfSegments,
            segments: details.segments,
            area: details.area,
          };
        });
      })
      .catch((e) => console.error(e));
  }

  startMeasure(type: 'line' | 'polygon'): void {
    this.measureDataSource.entities.removeAll();
    this.draw.type = type;
    this.draw.active = true;
    this.requestUpdate();
  }

  toggleMeasure(type: 'line' | 'polygon'): void {
    if ((!this.draw?.active && !this.measurements) || this.draw.type !== type) {
      this.startMeasure(type);
    } else {
      this.draw.active = false;
      this.draw.clear();
      if (this.measureDataSource) {
        this.measureDataSource.entities.removeAll();
      }
      this.measurements = undefined;
    }
  }

  render(): HTMLTemplateResult | string {
    return html`<div class="ngv-measure-btns-container">
        <wa-button
          class="${classMap({
            'ngv-active':
              (this.draw?.active || this.measurements) &&
              this.draw?.type === 'line',
          })}"
          appearance="filled"
          @click=${() => this.toggleMeasure('line')}
        >
          <wa-icon src="../../../icons/ruler.svg"></wa-icon>
        </wa-button>
        <wa-button
          class="${classMap({
            'ngv-active':
              (this.draw?.active || this.measurements) &&
              this.draw?.type === 'polygon',
          })}"
          appearance="filled"
          @click=${() => this.toggleMeasure('polygon')}
        >
          <wa-icon src="../../../icons/polygon.svg"></wa-icon>
        </wa-button>
      </div>
      <div class="ngv-submenu-overlay">
        <wa-card
          with-header
          class="${classMap({
            'wa-visually-hidden': !this.draw?.active && !this.measurements,
          })}"
        >
          <div slot="header">
            ${this.draw?.type === 'line'
              ? html`<wa-icon src="../../../icons/ruler.svg"></wa-icon> ${msg(
                    'Measure distance',
                  )}`
              : html`<wa-icon src="../../../icons/polygon.svg"></wa-icon> ${msg(
                    'Measure area',
                  )}`}
          </div>
          ${this.measurements
            ? html`<div class="ngv-measure-info-container">
                <div
                  class="ngv-measure-info ${classMap({
                    'wa-visually-hidden': !this.measurements?.segments?.length,
                  })}"
                >
                  ${this.measurements?.area
                    ? html`<div>
                        <span> ${msg('Area')} </span>
                        <span> ${this.measurements.area.toFixed(1)} m² </span>
                      </div>`
                    : ''}
                  ${this.measurements?.length
                    ? html`<div>
                        <span
                          >${this.measurements.type === 'polygon'
                            ? msg('Perimeter')
                            : msg('Total length')}</span
                        >
                        <span> ${this.measurements.length.toFixed(1)} m</span>
                      </div>`
                    : ''}
                  ${this.measurements?.numberOfSegments
                    ? html`<div>
                        <span> ${msg('Number of segments')} </span>
                        <span> ${this.measurements.numberOfSegments} </span>
                      </div>`
                    : ''}
                </div>
                <wa-details
                  .summary=${msg('Details per segment')}
                  class="custom-icons ${classMap({
                    'wa-visually-hidden': !this.measurements?.segments?.length,
                  })}"
                >
                  <wa-icon
                    name="square-plus"
                    slot="expand-icon"
                    variant="regular"
                  ></wa-icon>
                  <wa-icon
                    name="square-minus"
                    slot="collapse-icon"
                    variant="regular"
                  ></wa-icon>
                  <div class="ngv-measure-segments-info">
                    ${this.measurements?.segments &&
                    this.options.showSegmentsInfo
                      ? this.measurements.segments.map(
                          (s, k) => html`
                            <div class="ngv-measure-segments-info-item">
                              <span>${msg('Segment')} ${k + 1}</span>
                              <span
                                ><span>${msg('Length')}</span>:
                                ${s.length.toFixed(1)} m</span
                              >
                              ${this.options.showNEDifference
                                ? html`${!isNaN(s.eastingDiff)
                                    ? html`<span>
                                        <span>${msg('Easting difference')}</span
                                        >: ${s.eastingDiff.toFixed(1)} m
                                      </span>`
                                    : ''}
                                  ${!isNaN(s.northingDiff)
                                    ? html`<span>
                                        <span
                                          >${msg('Northing difference')}</span
                                        >: ${s.northingDiff.toFixed(1)} m
                                      </span>`
                                    : ''}`
                                : ''}
                              ${!isNaN(s.heightDiff) &&
                              this.options.showHeightDifferance
                                ? html`<span>
                                    <span>${msg('Height difference')}</span>:
                                    ${s.heightDiff.toFixed(1)} m
                                  </span>`
                                : ''}
                            </div>
                          `,
                        )
                      : ''}
                  </div></wa-details
                >
              </div>`
            : ''}
        </wa-card>
      </div>`;
  }

  createRenderRoot(): this {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-measure': NgvPluginCesiumMeasure;
  }
}
