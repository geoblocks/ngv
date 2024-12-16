import {customElement, property, state} from 'lit/decorators.js';
import {css, html, type HTMLTemplateResult, LitElement} from 'lit';
import type {
  Cartesian2,
  Cartesian3,
  Cesium3DTileset,
  CesiumWidget,
  CustomDataSource,
  Entity,
  PrimitiveCollection,
} from '@cesium/engine';
import {ClippingPolygon, ClippingPolygonCollection} from '@cesium/engine';
import {
  CallbackProperty,
  Color,
  ConstantProperty,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from '@cesium/engine';
import '../ui/ngv-layer-details.js';
import '../ui/ngv-layers-list.js';
import type {ClippingChangeDetail} from '../ui/ngv-layer-details.js';

@customElement('ngv-plugin-cesium-slicing')
export class NgvPluginCesiumSlicing extends LitElement {
  @property({type: Object})
  private viewer: CesiumWidget;
  @property({type: Object})
  private tiles3dCollection: PrimitiveCollection;
  @property({type: Object})
  private slicingDataSource: CustomDataSource;
  @state()
  private slicingActive: boolean = false;
  @state()
  private clippingPolygons: {clipping: ClippingPolygon; entity: Entity}[] = [];
  @state()
  private activePolygon: Entity | undefined = undefined;
  private editingClipping:
    | {clipping: ClippingPolygon; entity: Entity}
    | undefined = undefined;
  private eventHandler: ScreenSpaceEventHandler | undefined;
  private activePositions: Cartesian3[] = [];
  private floatingPoint: Entity | undefined = undefined;
  private points: Entity[] = [];

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
    }

    .slicing-container {
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

    .add-slicing-btn {
      width: 100%;
    }
  `;

  createPoint(position: Cartesian3 | CallbackProperty): Entity {
    return this.slicingDataSource.entities.add({
      position,
      point: {
        color: Color.RED,
        pixelSize: 5,
      },
    });
  }

  drawPolygon(): Entity {
    return this.slicingDataSource.entities.add({
      polygon: {
        hierarchy: new CallbackProperty(() => {
          return new PolygonHierarchy(this.activePositions);
        }, false),
        material: Color.RED.withAlpha(0.7),
      },
    });
  }

  private pickPosition(position: Cartesian2): Cartesian3 {
    const ray = this.viewer.camera.getPickRay(position);
    return this.viewer.scene.globe.show
      ? this.viewer.scene.globe.pick(ray, this.viewer.scene)
      : this.viewer.scene.pickPosition(position);
  }

  private startDrawing(positions: Cartesian3[], polygon?: Entity) {
    this.activePositions = [...positions];
    this.floatingPoint = this.createPoint(
      new CallbackProperty(() => {
        return this.activePositions[this.activePositions.length - 1];
      }, false),
    );
    if (polygon) {
      polygon.polygon.hierarchy = new CallbackProperty(() => {
        return new PolygonHierarchy(this.activePositions);
      }, false);
      polygon.show = true;
    }
    this.activePolygon = polygon ? polygon : this.drawPolygon();
    if (!this.activePolygon.name?.length) {
      const date = new Date();
      this.activePolygon.name = `Polygon ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }
    this.activePositions.forEach((position) => {
      this.points.push(this.createPoint(position));
    });
  }

  addClippingPolygon(): void {
    this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler.setInputAction(
      (event: ScreenSpaceEventHandler.PositionedEvent) => {
        const position = this.pickPosition(event.position);
        if (position) {
          if (this.activePositions.length === 0) {
            this.startDrawing([position]);
          }
          this.activePositions.push(position);
          this.points.push(this.createPoint(position));
        }
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );

    this.eventHandler.setInputAction(
      (event: ScreenSpaceEventHandler.MotionEvent) => {
        if (this.floatingPoint) {
          const ray = this.viewer.camera.getPickRay(event.endPosition);
          const newPosition = this.viewer.scene.globe.show
            ? this.viewer.scene.globe.pick(ray, this.viewer.scene)
            : this.viewer.scene.pickPosition(event.endPosition);
          if (newPosition) {
            this.activePositions.pop();
            this.activePositions.push(newPosition);
          }
        }
      },
      ScreenSpaceEventType.MOUSE_MOVE,
    );
    this.eventHandler.setInputAction(
      (event: ScreenSpaceEventHandler.PositionedEvent) => {
        const position = this.pickPosition(event.position);
        this.activePositions.push(position);
        this.finishSlicing();
      },
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    this.eventHandler.setInputAction(() => {
      if (this.activePositions.length > 1) {
        this.activePositions.splice(this.activePositions.length - 2, 1);
        this.slicingDataSource.entities.remove(this.points.pop());
      }
    }, ScreenSpaceEventType.RIGHT_CLICK);
    this.slicingActive = true;
  }

  finishSlicing(): void {
    this.eventHandler?.destroy();
    if (this.activePositions.length > 2) {
      // replace callback property
      this.activePolygon.polygon.hierarchy = new ConstantProperty(
        new PolygonHierarchy(this.activePositions),
      );
      this.activePolygon.show = false;
      const clippingPolygon = new ClippingPolygon({
        positions: this.activePositions,
      });
      if (this.editingClipping) {
        this.editingClipping.clipping = clippingPolygon;
      } else {
        this.clippingPolygons.push({
          clipping: clippingPolygon,
          entity: this.activePolygon,
        });
      }
      this.applyClipping(clippingPolygon);
    } else {
      this.slicingDataSource.entities.remove(this.activePolygon);
    }
    this.slicingDataSource.entities.remove(this.floatingPoint);
    this.points.forEach((p) => this.slicingDataSource.entities.remove(p));
    this.activePositions = [];
    this.points = [];
    this.floatingPoint = undefined;
    this.activePolygon = undefined;
    this.slicingActive = false;
    this.editingClipping = undefined;
  }

  applyClipping(clippingPolygon: ClippingPolygon): void {
    if (!this.viewer.scene.globe.clippingPolygons) {
      this.viewer.scene.globe.clippingPolygons =
        new ClippingPolygonCollection();
    }
    this.viewer.scene.globe.clippingPolygons.add(clippingPolygon);
    if (this.tiles3dCollection) {
      for (let i = 0; i < this.tiles3dCollection.length; i++) {
        const tileset: Cesium3DTileset = this.tiles3dCollection.get(
          i,
        ) as Cesium3DTileset;
        if (!tileset.clippingPolygons) {
          tileset.clippingPolygons = new ClippingPolygonCollection();
        }
        tileset.clippingPolygons.add(clippingPolygon);
      }
    }
  }

  removeClipping(clippingPolygon: ClippingPolygon): void {
    const globeClippingPolygons = this.viewer.scene.globe.clippingPolygons;
    if (
      globeClippingPolygons &&
      globeClippingPolygons.contains(clippingPolygon)
    ) {
      globeClippingPolygons.remove(clippingPolygon);
    }

    if (this.tiles3dCollection) {
      for (let i = 0; i < this.tiles3dCollection.length; i++) {
        const tileset: Cesium3DTileset = this.tiles3dCollection.get(
          i,
        ) as Cesium3DTileset;
        if (
          tileset.clippingPolygons &&
          tileset.clippingPolygons.contains(clippingPolygon)
        ) {
          tileset.clippingPolygons.remove(clippingPolygon);
        }
      }
    }
  }

  render(): HTMLTemplateResult | string {
    return html`<div class="slicing-container">
      <button class="add-slicing-btn" @click=${() => this.addClippingPolygon()}>
        Choose region to hide
      </button>
      ${this.slicingActive
        ? html` <ngv-layer-details
            .layer="${{
              name: this.activePolygon?.name,
              clippingOptions: {
                terrainClipping: true,
                tilesClipping: true,
              },
            }}"
            @clippingChange=${(evt: {detail: ClippingChangeDetail}) => {
              // todo
            }}
            @done="${() => {
              this.finishSlicing();
            }}"
          ></ngv-layer-details>`
        : html` <ngv-layers-list
            .options="${{
              title: 'Clipping polygons',
              showDeleteBtns: true,
              showZoomBtns: true,
              showEditBtns: true,
            }}"
            .layers=${this.clippingPolygons.map((c) => {
              return {name: c.entity.name};
            })}
            @remove=${(evt: {detail: number}) => {
              const polygonToRemove = this.clippingPolygons[evt.detail];
              if (polygonToRemove) {
                this.slicingDataSource.entities.removeById(
                  polygonToRemove.entity.id,
                );
                this.removeClipping(polygonToRemove.clipping);
                this.clippingPolygons.splice(evt.detail, 1);
                this.requestUpdate();
              }
            }}
            @zoom=${(evt: {detail: number}) => {
              const entToZoom = this.clippingPolygons[evt.detail]?.entity;
              if (entToZoom) {
                entToZoom.show = true;
                this.viewer
                  .flyTo(entToZoom, {
                    duration: 0,
                  })
                  .then(() => (entToZoom.show = false))
                  .catch((e: Error) => console.error(e));
              }
            }}
            @edit=${(evt: {detail: number}) => {
              const polToEdit = this.clippingPolygons[evt.detail];
              if (polToEdit) {
                this.editingClipping = polToEdit;
                this.removeClipping(polToEdit.clipping);
                const positions = (<{positions: Cartesian3[]}>(
                  polToEdit.entity.polygon.hierarchy.getValue()
                )).positions;
                this.startDrawing(positions, polToEdit.entity);
                this.addClippingPolygon();
              }
            }}
            @zoomEnter=${(e: {detail: number}) => {
              const entToZoom = this.clippingPolygons[e.detail]?.entity;
              if (entToZoom) entToZoom.show = true;
            }}
            @zoomOut=${(e: {detail: number}) => {
              const entToZoom = this.clippingPolygons[e.detail]?.entity;
              if (entToZoom) entToZoom.show = false;
            }}
          ></ngv-layers-list>`}
    </div>`;
  }
}
