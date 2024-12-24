import {customElement, property, state} from 'lit/decorators.js';
import {css, html, type HTMLTemplateResult, LitElement} from 'lit';
import type {
  Cartesian3,
  Cesium3DTileset,
  CesiumWidget,
  CustomDataSource,
  Entity,
  PrimitiveCollection,
} from '@cesium/engine';
import {ClippingPolygon, ClippingPolygonCollection} from '@cesium/engine';
import {
  Color,
  ConstantProperty,
  PolygonHierarchy,
} from '@cesium/engine';
import '../ui/ngv-layer-details.js';
import '../ui/ngv-layers-list.js';
import type {ClippingChangeDetail} from '../ui/ngv-layer-details.js';
import type { DrawEndDetails} from './draw.js';
import {CesiumDraw} from './draw.js';

export type ClippingData = {
  clipping: ClippingPolygon;
  entity: Entity;
};

@customElement('ngv-plugin-cesium-slicing')
export class NgvPluginCesiumSlicing extends LitElement {
  @property({type: Object})
  private viewer: CesiumWidget;
  @property({type: Object})
  private tiles3dCollection: PrimitiveCollection;
  @property({type: Object})
  private slicingDataSource: CustomDataSource;
  @state()
  private clippingPolygons: ClippingData[] = [];
  @state()
  private activePolygon: Entity | undefined = undefined;
  private editingClipping: ClippingData | undefined = undefined;
  private draw: CesiumDraw;

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

  firstUpdated(): void {
    this.draw = new CesiumDraw(this.viewer, this.slicingDataSource)
    this.draw.type = 'polygon';
    this.draw.addEventListener('drawend', (e) => {
      this.draw.active = false;
      const details: DrawEndDetails = (<CustomEvent<DrawEndDetails>>e).detail
      const clippingPolygon = new ClippingPolygon({
        positions: details.positions,
      });
      if (this.editingClipping) {
        this.editingClipping.clipping = clippingPolygon;
        this.applyClipping(this.editingClipping);
      } else {
        this.activePolygon.polygon.hierarchy = new ConstantProperty(new PolygonHierarchy(details.positions));
        const clipping = {
          clipping: clippingPolygon,
          entity: this.activePolygon,
        };
        this.clippingPolygons.push(clipping);
        this.applyClipping(clipping);
      }
      this.activePolygon = undefined;
    })
  }

  drawPolygon(positions: Cartesian3[]): Entity {
    const date = new Date();
    return this.slicingDataSource.entities.add({
      name: `Polygon ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
      // show: false,
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: Color.RED.withAlpha(0.7),
      },
      properties: {
        terrainClipping: true,
        tilesClipping: true,
      },
    });
  }

  addClippingPolygon(): void {
    this.draw.active = true;
    this.activePolygon = this.drawPolygon([])
  }

  applyClipping(clippingData: ClippingData): void {
    if (!this.viewer.scene.globe.clippingPolygons) {
      this.viewer.scene.globe.clippingPolygons =
        new ClippingPolygonCollection();
    }
    if (
      (<ConstantProperty>(
        clippingData.entity.properties.terrainClipping
      )).getValue()
    ) {
      this.viewer.scene.globe.clippingPolygons.add(clippingData.clipping);
    } else {
      this.removeTerrainClipping(clippingData.clipping);
    }
    if (this.tiles3dCollection) {
      if (
        (<ConstantProperty>(
          clippingData.entity.properties.tilesClipping
        )).getValue()
      ) {
        for (let i = 0; i < this.tiles3dCollection.length; i++) {
          const tileset: Cesium3DTileset = this.tiles3dCollection.get(
            i,
          ) as Cesium3DTileset;
          if (!tileset.clippingPolygons) {
            tileset.clippingPolygons = new ClippingPolygonCollection();
          }
          tileset.clippingPolygons.add(clippingData.clipping);
        }
      } else {
        this.removeTilesClipping(clippingData.clipping);
      }
    }
  }

  removeTerrainClipping(clippingPolygon: ClippingPolygon): void {
    const globeClippingPolygons = this.viewer.scene.globe.clippingPolygons;
    if (
      globeClippingPolygons &&
      globeClippingPolygons.contains(clippingPolygon)
    ) {
      globeClippingPolygons.remove(clippingPolygon);
    }
  }

  removeTilesClipping(clippingPolygon: ClippingPolygon): void {
    if (!this.tiles3dCollection) return;
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

  removeClipping(clippingPolygon: ClippingPolygon): void {
    this.removeTerrainClipping(clippingPolygon);
    this.removeTilesClipping(clippingPolygon);
  }

  render(): HTMLTemplateResult | string {
    return html`<div class="slicing-container">
      <button class="add-slicing-btn" @click=${() => this.addClippingPolygon()}>
        Choose region to hide
      </button>
      ${this.draw?.active
        ? html` <ngv-layer-details
            .layer="${{
              name: this.activePolygon?.name,
              clippingOptions: {
                terrainClipping: this.activePolygon
                  ? <boolean>(
                      (<ConstantProperty>(
                        this.activePolygon.properties.terrainClipping
                      )).getValue()
                    )
                  : true,
                tilesClipping: this.activePolygon
                  ? <boolean>(
                      (<ConstantProperty>(
                        this.activePolygon.properties.tilesClipping
                      )).getValue()
                    )
                  : true,
              },
            }}"
            @clippingChange=${(evt: {detail: ClippingChangeDetail}) => {
              this.activePolygon.properties.terrainClipping =
                new ConstantProperty(evt.detail.terrainClipping);
              this.activePolygon.properties.tilesClipping =
                new ConstantProperty(evt.detail.tilesClipping);
            }}
            @done="${() => {
              // todo
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
