import {customElement, property, state} from 'lit/decorators.js';
import {css, html, type HTMLTemplateResult, LitElement} from 'lit';
import {Task} from '@lit/task';
import type {
  CesiumWidget,
  DataSourceCollection,
  DirectionUp,
  PrimitiveCollection,
} from '@cesium/engine';
import type {Cartesian3} from '@cesium/engine';
import {
  Cartographic,
  Color,
  CustomDataSource,
  Entity,
  HeightReference,
  Rectangle,
} from '@cesium/engine';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import {
  calculateViewOnRectangle,
  updateHeightForCartesianPositions,
} from './interactionHelpers.js';
import {msg} from '@lit/localize';
import {classMap} from 'lit/directives/class-map.js';
import {getTilesetForOffline} from './cesium-utils.js';

type NavView = {
  destination: Cartesian3;
  orientation: DirectionUp;
  duration?: number;
};

type NavViews = {
  top: NavView;
  north: NavView;
  west: NavView;
  east: NavView;
  south: NavView;
  title: string;
  highlightEntity: Entity;
};

@customElement('ngv-plugin-cesium-navigation')
export class NgvPluginCesiumNavigation extends LitElement {
  @property({type: Object})
  public viewer: CesiumWidget;
  @property({type: Object})
  public dataSourceCollection: DataSourceCollection;
  @property({type: Object})
  public tiles3dCollection: PrimitiveCollection;
  @property({type: Array})
  public config: IngvCesiumContext;
  @property({type: Boolean})
  public offline: boolean = false;
  @state()
  private currentViewIndex: number;
  private currentView: NavViews;
  private dataSource: CustomDataSource = new CustomDataSource();

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

    button[disabled] {
      cursor: not-allowed;
    }

    .container {
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

    .nav-container {
      display: flex;
      column-gap: 5px;
    }

    .view-btns {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: 5px;
      align-items: center;
    }

    .view-btns > div {
      display: flex;
      flex-direction: column;
      row-gap: 5px;
    }

    .view-container {
      display: flex;
      flex-direction: column;
      row-gap: 5px;
      padding: 5px;
    }

    .view-container > h4 {
      margin: 0;
      padding: 5px;
    }

    .view-container > h4:hover {
      background-color: lightyellow;
      cursor: pointer;
    }

    .divider {
      width: 100%;
      border: 1px solid #e0e3e6;
    }

    .view-list {
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      padding: 8px 16px;
    }
    .view-list summary {
      cursor: pointer;
    }

    .view-list > div {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      row-gap: 5px;
    }

    .view-list button {
      height: auto;
      padding: 6px;
      border: none;
      text-align: left;
    }

    .view-list button.active,
    .view-list button:active,
    .view-list button:hover {
      background-color: lightyellow;
    }
  `;

  // @ts-expect-error TS6133
  private _offlineChangeTask = new Task(this, {
    args: (): [boolean] => [this.offline],
    task: ([offline]) => {
      if (!offline) {
        this.updateView();
      }
    },
  });

  updateView(): void {
    const v = this.config.views[this.currentViewIndex];
    if (v.tiles3d?.length) {
      this.tiles3dCollection.removeAll();
      v.tiles3d.forEach((catalogName) => {
        getTilesetForOffline({
          catalogName,
          ionAssetUrl: this.config.ionAssetUrl,
          extraOptions: this.config.layerOptions,
          cesiumApiUrl: this.config.cesiumApiUrl,
        })
          .then((tileset) => {
            if (tileset) {
              this.tiles3dCollection.add(tileset);
            }
          })
          .catch((err) => {
            console.log(err);
          });
      });
    }
    const positions: Cartographic[] = v.positions.map((p) =>
      Cartographic.fromDegrees(p[0], p[1]),
    );

    const baseRect = Rectangle.fromCartographicArray(positions);

    const nw = Cartographic.toCartesian(Rectangle.northwest(baseRect));
    const ne = Cartographic.toCartesian(Rectangle.northeast(baseRect));
    const sw = Cartographic.toCartesian(Rectangle.southwest(baseRect));
    const se = Cartographic.toCartesian(Rectangle.southeast(baseRect));
    const bottomPositions = [nw, ne, se, sw];
    updateHeightForCartesianPositions(bottomPositions, v.elevation, null, true);
    const [nwt, net, set, swt] = updateHeightForCartesianPositions(
      bottomPositions,
      v.elevation + v.height,
    );

    const highlightEntity = this.dataSource.entities.add(
      new Entity({
        show: false,
        polygon: {
          hierarchy: bottomPositions,
          heightReference: HeightReference.RELATIVE_TO_GROUND,
          extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND,
          material: v.highlightColor
            ? Color.fromCssColorString(v.highlightColor)
            : Color.RED.withAlpha(0.6),
          extrudedHeight: v.height,
        },
      }),
    );

    this.currentView = {
      top: {
        ...calculateViewOnRectangle(swt, set, nwt, net, v.fovAngle),
        duration: v.flyDuration,
      },
      north: {
        ...calculateViewOnRectangle(ne, nw, net, nwt, v.fovAngle),
        duration: v.flyDuration,
      },
      east: {
        ...calculateViewOnRectangle(se, ne, set, net, v.fovAngle),
        duration: v.flyDuration,
      },
      west: {
        ...calculateViewOnRectangle(nw, sw, nwt, swt, v.fovAngle),
        duration: v.flyDuration,
      },
      south: {
        ...calculateViewOnRectangle(sw, se, swt, set, v.fovAngle),
        duration: v.flyDuration,
      },
      title: v.title,
      highlightEntity,
    };
  }

  // @ts-expect-error TS6133
  private _changeViewTask = new Task(this, {
    args: (): [number] => [this.currentViewIndex],
    task: ([currentViewIndex]) => {
      this.dispatchEvent(
        new CustomEvent('viewChanged', {
          detail: this.config.views[currentViewIndex],
        }),
      );
      this.updateView();
      this.viewer.camera.flyTo(this.currentView.top);
    },
  });

  firstUpdated(): void {
    this.dataSourceCollection
      .add(this.dataSource)
      .then(() => {
        this.currentViewIndex = 0;
      })
      .catch((err) => console.error(err));
  }

  toNextView(): void {
    if (!this.config.views) return;
    const nextIndx = this.currentViewIndex + 1;
    if (nextIndx >= this.config.views.length) {
      this.currentViewIndex = 0;
      return;
    }
    this.currentViewIndex = nextIndx;
  }

  toPrevView(): void {
    if (!this.config.views) return;
    const prevIndx = this.currentViewIndex - 1;
    if (prevIndx < 0) {
      this.currentViewIndex = this.config.views.length - 1;
      return;
    }
    this.currentViewIndex = prevIndx;
  }

  public setViewById(id: string): void {
    if (!this.config.views) return;
    const index = this.config.views.findIndex((c) => c.id === id);
    if (index > -1) {
      this.currentViewIndex = index;
    }
  }

  render(): HTMLTemplateResult | string {
    if (!this.config.views?.length) return '';
    return html`<div class="container">
      ${this.config.views.length > 1
        ? html`<div class="nav-container">
              <button
                .disabled=${this.offline}
                @click=${() => this.toPrevView()}
              >
                ${msg('Previous')}
              </button>
              <button
                .disabled=${this.offline}
                @click=${() => this.toNextView()}
              >
                ${msg('Next')}
              </button>
            </div>
            <details .hidden=${this.offline} class="view-list">
              <summary>${msg('Places')}</summary>
              <div>
                ${this.config.views.map(
                  (view, index) =>
                    html` <button
                      class="${classMap({
                        active: this.currentViewIndex === index,
                      })}"
                      @click=${() => this.setViewById(view.id)}
                    >
                      ${view.title}
                    </button>`,
                )}
              </div>
            </details>
            <div class="divider"></div>`
        : ''}
      ${!this.currentView
        ? ''
        : html` <div class="view-container">
            <h4
              @mouseenter="${() => {
                this.currentView.highlightEntity.show = true;
              }}"
              @mouseout="${() => {
                this.currentView.highlightEntity.show = false;
              }}"
            >
              ${this.currentView.title}
            </h4>
            <div class="view-btns">
              <button
                @click="${() =>
                  this.viewer.camera.flyTo(this.currentView.west)}"
              >
                W
              </button>
              <div>
                <button
                  @click="${() =>
                    this.viewer.camera.flyTo(this.currentView.north)}"
                >
                  N
                </button>
                <button
                  @click="${() =>
                    this.viewer.camera.flyTo(this.currentView.top)}"
                >
                  TOP
                </button>
                <button
                  @click="${() =>
                    this.viewer.camera.flyTo(this.currentView.south)}"
                >
                  S
                </button>
              </div>
              <button
                @click="${() =>
                  this.viewer.camera.flyTo(this.currentView.east)}"
              >
                E
              </button>
            </div>
          </div>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-navigation': NgvPluginCesiumNavigation;
  }
}
