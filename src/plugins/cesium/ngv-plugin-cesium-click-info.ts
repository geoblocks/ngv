import {customElement, property, state} from 'lit/decorators.js';
import {css, html, type HTMLTemplateResult, LitElement} from 'lit';
import type {
  Cartesian3,
  CesiumWidget,
  DataSourceCollection,
  Entity,
} from '@cesium/engine';
import {Cartesian2} from '@cesium/engine';
import {
  ConstantPositionProperty,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  Math as CMath,
  Ellipsoid,
  ConstantProperty,
  Color,
} from '@cesium/engine';
import {CustomDataSource} from '@cesium/engine';
import proj4 from 'proj4';
import {msg} from '@lit/localize';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';

export type ClickDetail = {
  cartesian2: Cartesian2;
  cartesian3: Cartesian3;
  wgs84: {longitude: number; latitude: number};
  projected: {longitude: number; latitude: number};
  elevation: number;
  distToTerrain: number;
};

@customElement('ngv-plugin-cesium-click-info')
export class NgvPluginCesiumClickInfo extends LitElement {
  @property({type: Object})
  public viewer: CesiumWidget;
  @property({type: Object})
  public dataSourceCollection: DataSourceCollection;
  @property({type: Object})
  public options: IngvCesiumContext['clickInfoOptions'] = {type: 'cesium'};
  @state()
  private popupContent: {
    projected: string;
    wgs84Coords: string;
    elevation: string;
    distToTerrain: string;
  } | null = null;
  private dataSource: CustomDataSource = new CustomDataSource();
  private eventHandler: ScreenSpaceEventHandler | null = null;
  private labelEntity: Entity = null;
  private labelTimeout: ReturnType<typeof setTimeout> | null = null;
  private detail: {
    cartesian2: Cartesian2;
    cartesian3: Cartesian3;
    wgs84: {longitude: number; latitude: number};
    projected: {longitude: number; latitude: number};
    elevation: number;
    distToTerrain: number;
  };

  static styles = css`
    :host {
      z-index: 1;
      display: block;
      position: absolute;
    }

    .container {
      background-color: #fff;
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

    button {
      border-radius: 4px;
      padding: 0 12px;
      height: 30px;
      cursor: pointer;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      transition: background-color 200ms;
    }
  `;

  showCoordinates(evt: ScreenSpaceEventHandler.PositionedEvent): void {
    if (this.labelTimeout) {
      clearTimeout(this.labelTimeout);
      this.labelTimeout = null;
    }
    this.labelEntity.show = false;
    if (!evt?.position) return;
    const position = this.viewer.scene.pickPosition(evt.position);
    if (!position) return;
    const cartographicPosition =
      Ellipsoid.WGS84.cartesianToCartographic(position);
    const latitude = CMath.toDegrees(cartographicPosition.latitude);
    const longitude = CMath.toDegrees(cartographicPosition.longitude);
    const elevation = cartographicPosition.height;
    this.labelEntity.position = new ConstantPositionProperty(position);
    const globElev =
      this.viewer.scene.globe.getHeight(cartographicPosition) || 0;
    const distToTerrain = elevation - globElev;
    const wgs84Text = `${longitude.toFixed(5)},  ${latitude.toFixed(5)}`;
    const elevationText = `${elevation.toFixed(2)}m`;
    const distToTerrainText = `${distToTerrain.toFixed(2)}m`;
    let projectedText = '';
    let projectedCoords: [number, number] = [null, null];
    if (this.options.projection) {
      projectedCoords = proj4('EPSG:4326', this.options.projection, [
        longitude,
        latitude,
      ]);
      projectedText = `${projectedCoords[0]}, ${projectedCoords[1]}`;
    }
    this.detail = {
      cartesian2: evt.position,
      cartesian3: position,
      wgs84: {longitude, latitude},
      projected: {longitude: projectedCoords[0], latitude: projectedCoords[1]},
      elevation,
      distToTerrain,
    };
    if (this.options.type === 'cesium') {
      let text = projectedText
        ? `${this.options.projection}: ${projectedText}\n`
        : '';
      if (this.options.showWgs84) {
        text += `WGS 84: ${wgs84Text}\n`;
      }
      if (this.options.showAmslElevation) {
        text += `${msg('Elevation (AMSL)')}: ${elevationText}\n`;
      }
      if (this.options.showTerrainDistance) {
        text += `${msg('Elevation (from terrain)')}: ${distToTerrainText}\n`;
      }
      this.labelEntity.label.text = new ConstantProperty(text);
    } else {
      const canvasBbox = this.viewer.canvas.getBoundingClientRect();
      this.popupContent = {
        projected: projectedText,
        wgs84Coords: wgs84Text,
        elevation: elevationText,
        distToTerrain: distToTerrainText,
      };
      this.style.left = canvasBbox.x + evt.position.x + 'px';
      this.style.top = canvasBbox.y + evt.position.y + 5 + 'px';
    }
    this.labelEntity.show = true;
  }

  connectedCallback(): void {
    this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler.setInputAction(
      (evt: ScreenSpaceEventHandler.PositionedEvent) =>
        this.showCoordinates(evt),
      ScreenSpaceEventType.RIGHT_CLICK,
    );
    this.eventHandler.setInputAction(
      (evt: ScreenSpaceEventHandler.PositionedEvent) => {
        if (this.options.type === 'cesium') {
          const pickedObject = <{id?: Entity}>(
            this.viewer.scene.pick(evt.position)
          );
          if (pickedObject?.id && pickedObject.id === this.labelEntity) {
            const labelText: string = <string>(
              pickedObject.id.label.text.getValue()
            );
            navigator.clipboard
              .writeText(labelText)
              .then(() => {
                this.labelEntity.label.text = new ConstantProperty('Copied');
                this.labelTimeout = setTimeout(() => {
                  this.labelEntity.label.text = new ConstantProperty(labelText);
                  this.labelTimeout = null;
                }, 1000);
              })
              .catch((err) => {
                console.log(err);
              });
          } else {
            this.labelEntity.show = false;
          }
        } else {
          this.popupContent = null;
          this.labelEntity.show = false;
        }
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.viewer.camera.moveStart.addEventListener(() => {
      if (this.popupContent) {
        this.popupContent = null;
        this.labelEntity.show = false;
      }
    });
    this.dataSourceCollection
      .add(this.dataSource)
      .then(() => {
        const pointConf = this.options.pointOptions;
        const entity: Entity.ConstructorOptions = {
          show: false,
          point: {
            color: pointConf?.color
              ? Color.fromCssColorString(pointConf?.color)
              : Color.WHITE,
            outlineWidth:
              typeof pointConf?.outlineWidth === 'number'
                ? pointConf.outlineWidth
                : 2,
            outlineColor: pointConf?.outlineColor
              ? Color.fromCssColorString(pointConf.outlineColor)
              : Color.BLACK,
            pixelSize: pointConf?.pixelSize || 5,
            heightReference: HeightReference.NONE,
          },
        };
        if (this.options.type === 'cesium') {
          const labelConf = this.options.cesiumLabelOptions;
          entity.label = {
            heightReference: HeightReference.NONE,
            font: labelConf?.font || '8pt arial',
            style: labelConf?.style || LabelStyle.FILL,
            showBackground:
              typeof labelConf?.showBackground === 'boolean'
                ? labelConf.showBackground
                : true,
            verticalOrigin: labelConf?.verticalOrigin || VerticalOrigin.BOTTOM,
            horizontalOrigin:
              labelConf?.horizontalOrigin || HorizontalOrigin.RIGHT,
            disableDepthTestDistance:
              typeof labelConf?.disableDepthTestDistance === 'number'
                ? labelConf.disableDepthTestDistance
                : Number.POSITIVE_INFINITY,
          };
          if (labelConf?.pixelOffset) {
            entity.label.pixelOffset = new Cartesian2(
              labelConf.pixelOffset.x,
              labelConf.pixelOffset.y,
            );
          }
          if (labelConf?.backgroundPadding) {
            entity.label.backgroundPadding = new Cartesian2(
              labelConf.backgroundPadding.x,
              labelConf.backgroundPadding.y,
            );
          }
          if (labelConf?.backgroundColor) {
            entity.label.backgroundColor = Color.fromCssColorString(
              labelConf.backgroundColor,
            );
          }
        }

        this.labelEntity = this.dataSource.entities.add(entity);
      })
      .catch((err) => console.error(err));
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    this.eventHandler.destroy();
    this.eventHandler = null;
    super.disconnectedCallback();
  }

  render(): HTMLTemplateResult | string {
    if (this.options.type !== 'html' || !this.popupContent) return '';
    return html`<div class="container">
      <span .hidden=${!this.options.projection}
        ><b>${this.options.projection}:</b> ${this.popupContent.projected}</span
      >
      <span .hidden=${!this.options.showWgs84}
        ><b>WGS84:</b> ${this.popupContent.wgs84Coords}</span
      >
      <span .hidden=${!this.options.showAmslElevation}
        ><b>${msg('Elevation (AMSL)')}:</b> ${this.popupContent.elevation}</span
      >
      <span .hidden=${!this.options.showTerrainDistance}
        ><b>${msg('Elevation (from terrain)')}</b> ${this.popupContent
          .distToTerrain}</span
      >
      ${this.options?.actionBtn
        ? html`<button
            @click="${() => {
              this.dispatchEvent(
                new CustomEvent<ClickDetail>('action', {detail: this.detail}),
              );
              this.popupContent = null;
              this.labelEntity.show = false;
            }}"
          >
            ${msg(this.options.actionBtnLabel)}
          </button>`
        : ''}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-click-info': NgvPluginCesiumClickInfo;
  }
}
