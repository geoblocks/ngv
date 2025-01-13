import {customElement, property, state} from 'lit/decorators.js';
import {css, html, type HTMLTemplateResult, LitElement} from 'lit';
import {msg} from '@lit/localize';
import type {CesiumWidget, DataSourceCollection, Entity} from '@cesium/engine';
import {Color, CustomDataSource, HeightReference} from '@cesium/engine';
import type {DrawInfo} from './draw.js';
import {CesiumDraw, type DrawEndDetails, getDimensionLabel} from './draw.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';

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

  static styles = css`
    button {
      border-radius: 4px;
      padding: 0 16px;
      height: 40px;
      cursor: pointer;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      transition: background-color 200ms;
      width: 100%;
    }

    .measure-container {
      display: flex;
      flex-direction: column;
      margin-left: auto;
      margin-right: auto;
      padding: 10px;
      gap: 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
    }

    .measure-container p {
      margin: 5px 0;
    }

    .divider {
      width: 100%;
      border: 1px solid #e0e3e6;
    }
  `;

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

  render(): HTMLTemplateResult | string {
    return html`<div class="measure-container">
      ${this.draw?.active
        ? html` <button
            @click=${() => {
              this.draw.active = false;
              this.draw.clear();
              this.measurements = undefined;
            }}
          >
            ${msg('Cancel')}
          </button>`
        : html`<button @click=${() => this.startMeasure('line')}>
              ${msg('Measure distance')}
            </button>
            <button @click=${() => this.startMeasure('polygon')}>
              ${msg('Measure area')}
            </button>`}
      ${!this.draw?.active && this.measureDataSource.entities.values.length > 0
        ? html`<button
            @click=${() => {
              this.measureDataSource.entities.removeAll();
              this.measurements = undefined;
            }}
          >
            ${msg('Clear')}
          </button>`
        : ''}
      ${this.measurements
        ? html`<div class="measure-container">
            ${this.measurements?.area
              ? html`<p>
                  ${msg('Area')}: ${this.measurements.area.toFixed(1)} m²
                </p>`
              : ''}
            ${this.measurements?.length
              ? html`<p>
                  ${this.measurements.type === 'polygon'
                    ? msg('Perimeter')
                    : msg('Total length')}:
                  ${this.measurements.length.toFixed(1)} m
                </p>`
              : ''}
            ${this.measurements?.numberOfSegments
              ? html`<p>
                  ${msg('Number of segments')}:
                  ${this.measurements.numberOfSegments}
                </p>`
              : ''}
            ${this.measurements?.segments
              ? this.measurements.segments.map(
                  (s, k) => html`
                    <div class="divider"></div>
                    <p>${msg('Segment')} ${k + 1}</p>
                    <p>${msg('Length')}: ${s.length.toFixed(1)} m</p>
                    ${!isNaN(s.eastingDiff)
                      ? html`<p>
                          ${msg('Easting difference')}:
                          ${s.eastingDiff.toFixed(1)} m
                        </p>`
                      : ''}
                    ${!isNaN(s.northingDiff)
                      ? html`<p>
                          ${msg('Northing difference')}:
                          ${s.northingDiff.toFixed(1)} m
                        </p>`
                      : ''}
                    ${!isNaN(s.heightDiff)
                      ? html`<p>
                          ${msg('Height difference')}:
                          ${s.heightDiff.toFixed(1)} m
                        </p>`
                      : ''}
                  `,
                )
              : ''}
          </div>`
        : ''}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-measure': NgvPluginCesiumMeasure;
  }
}
