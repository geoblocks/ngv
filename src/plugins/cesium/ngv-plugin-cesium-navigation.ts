import {customElement, property, state} from 'lit/decorators.js';
import {html, type HTMLTemplateResult, LitElement} from 'lit';
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

  createRenderRoot(): this {
    return this;
  }

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
          extrudedHeight: v.elevation + v.height,
          height: v.elevation,
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
    return html` <wa-card with-header>
      <div slot="header">
        <wa-icon src="../../../icons/camera.svg"></wa-icon>
        ${msg('Interact with objects in the scene')}
      </div>
      ${this.config.views.length > 1
        ? html`<wa-card class="nav-container">
            <wa-icon-button
              name="chevron-left"
              .disabled=${this.offline}
              @click="${() => this.toPrevView()}"
            ></wa-icon-button>
            <wa-dropdown placement="bottom">
              <wa-button
                slot="trigger"
                size="medium"
                appearance="outlined"
                @mouseenter="${() => {
                  this.currentView.highlightEntity.show = true;
                }}"
                @mouseout="${() => {
                  this.currentView.highlightEntity.show = false;
                }}"
                >${this.currentView?.title}</wa-button
              >
              <wa-menu>
                ${this.config.views.map((view, index) => {
                  return html` <wa-menu-item
                    .value=${index}
                    @click=${() => this.setViewById(view.id)}
                  >
                    ${view.title}
                  </wa-menu-item>`;
                })}
              </wa-menu>
            </wa-dropdown>
            <wa-icon-button
              name="chevron-right"
              .disabled=${this.offline}
              @click=${() => this.toNextView()}
            ></wa-icon-button>
          </wa-card>`
        : ''}
      ${!this.currentView
        ? ''
        : html`<wa-card class="ngv-view-navigation-card" with-header>
            <div slot="header">${msg('Choose a view')}</div>
            <div>
              <div class="ngv-view-btns">
                <wa-button
                  class="ngv-view-btns-n"
                  size="small"
                  appearance="filled"
                  @click="${() =>
                    this.viewer.camera.flyTo(this.currentView.north)}"
                >
                  <wa-icon
                    slot="prefix"
                    src="../../../icons/north.svg"
                  ></wa-icon>
                  ${msg('North')}
                </wa-button>
                <wa-button
                  class="ngv-view-btns-w"
                  size="small"
                  appearance="filled"
                  @click="${() =>
                    this.viewer.camera.flyTo(this.currentView.west)}"
                >
                  <wa-icon
                    slot="prefix"
                    src="../../../icons/west.svg"
                  ></wa-icon>
                  ${msg('West')}
                </wa-button>
                <wa-button
                  class="ngv-view-btns-t"
                  size="small"
                  appearance="filled"
                  @click="${() =>
                    this.viewer.camera.flyTo(this.currentView.top)}"
                >
                  <wa-icon slot="prefix" src="../../../icons/top.svg"></wa-icon>
                  ${msg('Top')}
                </wa-button>
                <wa-button
                  class="ngv-view-btns-e"
                  size="small"
                  appearance="filled"
                  @click="${() =>
                    this.viewer.camera.flyTo(this.currentView.east)}"
                >
                  <wa-icon
                    slot="prefix"
                    src="../../../icons/east.svg"
                  ></wa-icon>
                  ${msg('East')}
                </wa-button>
                <wa-button
                  class="ngv-view-btns-s"
                  size="small"
                  appearance="filled"
                  @click="${() =>
                    this.viewer.camera.flyTo(this.currentView.south)}"
                >
                  <wa-icon
                    slot="prefix"
                    src="../../../icons/south.svg"
                  ></wa-icon>
                  ${msg('South')}
                </wa-button>
              </div>
            </div>
          </wa-card>`}
    </wa-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-navigation': NgvPluginCesiumNavigation;
  }
}
