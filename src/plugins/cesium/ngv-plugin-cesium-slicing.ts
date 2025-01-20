import {customElement, property, state} from 'lit/decorators.js';
import {css, html, type HTMLTemplateResult, LitElement} from 'lit';
import type {
  Cesium3DTileset,
  CesiumWidget,
  DataSourceCollection,
  PrimitiveCollection,
} from '@cesium/engine';
import {
  Cartesian3,
  ClippingPolygon,
  ClippingPolygonCollection,
  Color,
  ConstantProperty,
  CustomDataSource,
  Entity,
  HeightReference,
  JulianDate,
  PolygonHierarchy,
} from '@cesium/engine';
import '../ui/ngv-layer-details.js';
import '../ui/ngv-layers-list.js';
import type {ClippingChangeDetail} from '../ui/ngv-layer-details.js';
import type {DrawEndDetails} from './draw.js';
import {CesiumDraw} from './draw.js';
import {msg} from '@lit/localize';
import type {StoredClipping} from './localStore.js';
import {getStoredClipping, updateClippingInLocalStore} from './localStore.js';
import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import {Task} from '@lit/task';

export type ClippingData = {
  clipping: ClippingPolygon;
  entity: Entity;
};

export type ClippingEntityProps = {
  terrainClipping: boolean;
  tilesClipping: boolean;
};

@customElement('ngv-plugin-cesium-slicing')
export class NgvPluginCesiumSlicing extends LitElement {
  @property({type: Object})
  private viewer: CesiumWidget;
  @property({type: Object})
  private tiles3dCollection: PrimitiveCollection;
  @property({type: Object})
  private dataSourceCollection: DataSourceCollection;
  @property({type: Object})
  private options: IngvCesiumContext['clippingOptions'] | undefined;
  @state()
  private clippingPolygons: ClippingData[] = [];
  @state()
  private activePolygon: Entity | undefined = undefined;
  @state()
  private editingClipping: ClippingData | undefined = undefined;
  @state()
  private terrainClippingEnabled: boolean = true;
  @state()
  private tilesClippingEnabled: boolean = true;
  private draw: CesiumDraw;
  private slicingDataSource: CustomDataSource = new CustomDataSource();
  private drawDataSource: CustomDataSource = new CustomDataSource();
  private julianDate = new JulianDate();

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

  // @ts-expect-error TS6133
  private _changeViewTask = new Task(this, {
    args: (): [IngvCesiumContext['clippingOptions']] => [this.options],
    task: ([options]) => {
      this.terrainClippingEnabled =
        typeof options?.terrainClippingEnabled === 'boolean'
          ? options?.terrainClippingEnabled
          : true;
      this.tilesClippingEnabled =
        typeof options?.tilesClippingEnabled === 'boolean'
          ? options?.tilesClippingEnabled
          : true;
    },
  });

  firstUpdated(): void {
    this.dataSourceCollection
      .add(this.slicingDataSource)
      .then(() => {
        if (this.options?.storeKey) {
          const storedClipping = getStoredClipping(this.options?.storeKey);
          storedClipping.forEach((clipping) => {
            const positions = clipping.positions.map(
              (p) => new Cartesian3(p[0], p[1], p[2]),
            );
            if (positions?.length < 3) return;
            const entity = this.drawPolygon(positions, clipping.name, {
              terrainClipping: clipping.terrainClipping,
              tilesClipping: clipping.tilesClipping,
            });
            const clippingData = {
              entity,
              clipping: new ClippingPolygon({positions}),
            };
            this.clippingPolygons.push(clippingData);
            this.applyClipping(clippingData);
          });
          this.requestUpdate();
        }
      })
      .catch((e) => console.error(e));
    this.dataSourceCollection
      .add(this.drawDataSource)
      .then((drawDataSource) => {
        this.draw = new CesiumDraw(this.viewer, drawDataSource, {
          lineClampToGround: false,
          pointOptions: {heightReference: HeightReference.NONE},
        });
        this.draw.type = 'polygon';
        this.draw.addEventListener('drawend', (e) => {
          this.onDrawEnd((<CustomEvent<DrawEndDetails>>e).detail);
        });
      })
      .catch((e) => console.error(e));
    this.tiles3dCollection.primitiveAdded.addEventListener(
      (tileset: Cesium3DTileset) => {
        this.clippingPolygons.forEach((cp) =>
          this.applyClippingOnTileset(tileset, cp.clipping),
        );
      },
    );
  }

  saveToLocalStore(): void {
    if (!this.options?.storeKey) return;
    const clippingsToStore: StoredClipping[] =
      this.slicingDataSource.entities.values.map((e) => {
        const properties = <ClippingEntityProps>(
          e.properties.getValue(this.julianDate)
        );
        return {
          name: e.name,
          positions: (<PolygonHierarchy>(
            e.polygon.hierarchy.getValue(this.julianDate)
          )).positions.map((p) => [p.x, p.y, p.z]),
          terrainClipping: properties.terrainClipping,
          tilesClipping: properties.tilesClipping,
        };
      });
    updateClippingInLocalStore(clippingsToStore, this.options?.storeKey);
  }

  onDrawEnd(details: DrawEndDetails): void {
    this.draw.active = false;
    const clippingPolygon = new ClippingPolygon({
      positions: details.positions,
    });
    if (this.editingClipping) {
      this.editingClipping.clipping = clippingPolygon;
      this.applyClipping(this.editingClipping);
    } else {
      this.activePolygon.polygon.hierarchy = new ConstantProperty(
        new PolygonHierarchy(details.positions),
      );
      const clipping = {
        clipping: clippingPolygon,
        entity: this.activePolygon,
      };
      this.clippingPolygons.push(clipping);
      this.applyClipping(clipping);
    }
    this.activePolygon = undefined;
    this.saveToLocalStore();
  }

  drawPolygon(
    positions?: Cartesian3[],
    name?: string,
    properties?: ClippingEntityProps,
  ): Entity {
    const date = new Date();
    return this.slicingDataSource.entities.add({
      name:
        name ||
        `Polygon ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
      show: false,
      polygon: {
        hierarchy: positions || [],
        material: Color.RED.withAlpha(0.7),
      },
      properties: properties || {
        terrainClipping: this.terrainClippingEnabled,
        tilesClipping: this.tilesClippingEnabled,
      },
    });
  }

  addClippingPolygon(): void {
    this.draw.active = true;
    this.activePolygon = this.drawPolygon();
  }

  applyClipping(clippingData: ClippingData): void {
    if (!this.viewer.scene.globe.clippingPolygons) {
      this.viewer.scene.globe.clippingPolygons =
        new ClippingPolygonCollection();
    }
    if (
      (<ConstantProperty>(
        clippingData.entity.properties.terrainClipping
      )).getValue() &&
      this.tilesClippingEnabled
    ) {
      this.viewer.scene.globe.clippingPolygons.add(clippingData.clipping);
    } else {
      this.removeTerrainClipping(clippingData.clipping);
    }
    if (this.tiles3dCollection) {
      if (
        (<ConstantProperty>(
          clippingData.entity.properties.tilesClipping
        )).getValue() &&
        this.tilesClippingEnabled
      ) {
        for (let i = 0; i < this.tiles3dCollection.length; i++) {
          const tileset: Cesium3DTileset = this.tiles3dCollection.get(
            i,
          ) as Cesium3DTileset;
          this.applyClippingOnTileset(tileset, clippingData.clipping);
        }
      } else {
        this.removeTilesClipping(clippingData.clipping);
      }
    }
  }

  applyClippingOnTileset(
    tileset: Cesium3DTileset,
    clippingPolygon: ClippingPolygon,
  ): void {
    if (!tileset.clippingPolygons) {
      tileset.clippingPolygons = new ClippingPolygonCollection();
    }
    tileset.clippingPolygons.add(clippingPolygon);
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
      <button
        class="add-slicing-btn"
        .hidden=${this.draw?.active}
        @click=${() => this.addClippingPolygon()}
      >
        ${msg('Choose region to hide')}
      </button>
      ${this.draw?.active
        ? html` <ngv-layer-details
            .layer="${{
              name: this.activePolygon?.name,
              clippingOptions:
                this.terrainClippingEnabled && this.tilesClippingEnabled
                  ? {
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
                    }
                  : undefined,
            }}"
            .showDone=${this.draw?.entityForEdit}
            .showCancel=${true}
            @clippingChange=${(evt: {detail: ClippingChangeDetail}) => {
              this.activePolygon.properties.terrainClipping =
                new ConstantProperty(evt.detail.terrainClipping);
              this.activePolygon.properties.tilesClipping =
                new ConstantProperty(evt.detail.tilesClipping);
            }}
            @done="${() => {
              if (this.draw.entityForEdit) {
                const positions: Cartesian3[] = (<PolygonHierarchy>(
                  this.draw.entityForEdit.polygon.hierarchy.getValue(
                    this.julianDate,
                  )
                )).positions;
                this.editingClipping.entity.polygon.hierarchy =
                  new ConstantProperty(new PolygonHierarchy(positions));
                this.editingClipping.clipping = new ClippingPolygon({
                  positions,
                });
                this.applyClipping(this.editingClipping);
                this.activePolygon = undefined;
                this.draw.active = false;
                this.draw.clear();
                this.requestUpdate();
                this.saveToLocalStore();
              }
            }}"
            @cancel="${() => {
              if (this.draw?.entityForEdit) {
                this.applyClipping(this.editingClipping);
              }
              this.draw.active = false;
              this.draw.clear();
              this.requestUpdate();
            }}"
          ></ngv-layer-details>`
        : html` <ngv-layers-list
            .options="${{
              title: msg('Clipping polygons'),
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
                this.saveToLocalStore();
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
                this.draw.type = 'polygon';
                this.activePolygon = polToEdit.entity;
                this.draw.entityForEdit = this.drawDataSource.entities.add(
                  new Entity({polygon: polToEdit.entity.polygon.clone()}),
                );
                this.draw.active = true;
                this.requestUpdate();
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
