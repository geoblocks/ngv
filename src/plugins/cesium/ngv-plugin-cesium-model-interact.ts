import {html, LitElement} from 'lit';
import type {HTMLTemplateResult, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {
  CesiumWidget,
  DataSource,
  PrimitiveCollection,
  DataSourceCollection,
  Cartesian2,
  Cesium3DTileset,
  Event,
} from '@cesium/engine';
import {
  Model,
  Cartesian3,
  Color,
  Matrix4,
  Plane,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Quaternion,
  CustomDataSource,
  Ellipsoid,
  TranslationRotationScale,
  Entity,
  ColorMaterialProperty,
} from '@cesium/engine';
import {instantiateModel} from './ngv-cesium-factories.js';
import type {StoredModel} from './localStore.js';
import {
  deleteFromIndexedDB,
  getBlobFromIndexedDB,
  getStoredModels,
  updateModelsInLocalStore,
} from './localStore.js';
import '../ui/ngv-layer-details.js';
import '../ui/ngv-layers-list.js';
import type {BBoxStyles} from './interactionHelpers.js';
import {
  applyClippingTo3dTileset,
  removeClippingFrom3dTilesets,
  updateModelClipping,
} from './interactionHelpers.js';
import {
  getHorizontalMoveVector,
  getTranslationFromMatrix,
  getVerticalMoveVector,
  rotate,
  scale,
  showModelBBox,
} from './interactionHelpers.js';
import type {INGVCesiumModel} from '../../interfaces/cesium/ingv-layers.js';
import type {ClippingChangeDetail} from '../ui/ngv-layer-details.js';

type GrabType = 'side' | 'top' | 'edge' | 'corner' | undefined;

@customElement('ngv-plugin-cesium-model-interact')
export class NgvPluginCesiumModelInteract extends LitElement {
  @property({type: Object})
  private viewer: CesiumWidget;
  @property({type: Object})
  private primitiveCollection: PrimitiveCollection;
  @property({type: Object})
  private tiles3dCollection: PrimitiveCollection;
  @property({type: Object})
  private dataSourceCollection: DataSourceCollection;
  @property({type: Object})
  private bboxStyle: BBoxStyles | undefined;
  @property({type: Object})
  private storeOptions?: {
    localStoreKey: string;
    indexDbName: string;
  };
  @property({type: Object})
  private options?: {
    listTitle: string;
  };
  @state()
  private cursor:
    | 'default'
    | 'move'
    | 'pointer'
    | 'ns-resize'
    | 'ew-resize'
    | 'nesw-resize' = 'default';
  @state()
  private chosenModel: INGVCesiumModel | undefined;
  @state()
  private position: Cartesian3 = new Cartesian3();
  @state()
  private models: INGVCesiumModel[] = [];
  private eventHandler: ScreenSpaceEventHandler | undefined;
  private sidePlanesDataSource: DataSource | undefined;
  private topDownPlanesDataSource: DataSource | undefined;
  private edgeLinesDataSource: DataSource | undefined;
  private cornerPointsDataSource: DataSource | undefined;
  private moveStart: Cartesian3 = new Cartesian3();
  private moveStep: Cartesian3 = new Cartesian3();
  private pickedPointOffset: Cartesian3 = new Cartesian3();
  private dragStart: boolean = false;
  private movePlane: Plane | undefined;
  private grabType: GrabType;
  private hoveredEdge: Entity | undefined;
  private cameraMoving = false;
  private unlistenMoveStart: Event.RemoveCallback;
  private unlistenMoveEnd: Event.RemoveCallback;

  initEvents(): void {
    this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler.setInputAction(
      (evt: ScreenSpaceEventHandler.MotionEvent) => this.onMouseMove(evt),
      ScreenSpaceEventType.MOUSE_MOVE,
    );
    this.eventHandler.setInputAction(
      (evt: ScreenSpaceEventHandler.PositionedEvent) => this.onClick(evt),
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.eventHandler.setInputAction(
      (evt: ScreenSpaceEventHandler.PositionedEvent) => this.onLeftDown(evt),
      ScreenSpaceEventType.LEFT_DOWN,
    );
    this.eventHandler.setInputAction(
      () => this.onLeftUp(),
      ScreenSpaceEventType.LEFT_UP,
    );

    this.primitiveCollection.primitiveAdded.addEventListener(
      (model: INGVCesiumModel) => {
        this.onPrimitivesChanged();
        updateModelClipping(
          model,
          this.tiles3dCollection,
          this.viewer.scene.globe,
        );
      },
    );
    this.primitiveCollection.primitiveRemoved.addEventListener(
      (p: INGVCesiumModel) => {
        if (this.storeOptions) {
          deleteFromIndexedDB(this.storeOptions.indexDbName, p.id.name)
            .then(() => this.onPrimitivesChanged())
            .catch((e) => console.error(e));
        } else {
          this.onPrimitivesChanged();
        }
      },
    );
    this.tiles3dCollection?.primitiveAdded.addEventListener(
      (tileset: Cesium3DTileset) => {
        applyClippingTo3dTileset(tileset, this.models);
      },
    );
    this.unlistenMoveStart = this.viewer.camera.moveStart.addEventListener(
      () => (this.cameraMoving = true),
    );
    this.unlistenMoveEnd = this.viewer.camera.moveEnd.addEventListener(
      () => (this.cameraMoving = false),
    );
  }

  removeEvents(): void {
    if (this.cursor !== 'default') {
      this.viewer.canvas.style.cursor = 'default';
    }
    if (this.eventHandler) {
      this.eventHandler.destroy();
      this.eventHandler = null;
    }
    if (this.unlistenMoveStart) this.unlistenMoveStart();
    if (this.unlistenMoveEnd) this.unlistenMoveEnd();
  }

  onPrimitivesChanged(): void {
    this.models = [];
    for (let i = 0; i < this.primitiveCollection.length; i++) {
      const model = this.primitiveCollection.get(i) as INGVCesiumModel;
      if (model instanceof Model) {
        this.models.push(model);
      }
    }
    if (this.storeOptions) {
      updateModelsInLocalStore(this.storeOptions.localStoreKey, this.models);
    }
  }

  onClick(evt: ScreenSpaceEventHandler.PositionedEvent): void {
    const model: Model | undefined = this.pickModel(evt.position);
    if (model) {
      if (!this.chosenModel) {
        this.chosenModel = model;
        Matrix4.getTranslation(this.chosenModel.modelMatrix, this.position);
        showModelBBox(
          {
            topDownPlanesDataSource: this.topDownPlanesDataSource,
            sidePlanesDataSource: this.sidePlanesDataSource,
            edgeLinesDataSource: this.edgeLinesDataSource,
            cornerPointsDataSource: this.cornerPointsDataSource,
          },
          this.chosenModel,
          this.viewer.scene,
          this.bboxStyle,
        );
      }
    }
  }

  onLeftDown(evt: ScreenSpaceEventHandler.PositionedEvent): void {
    this.grabType = this.pickGrabType(evt.position);
    if (this.grabType) {
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
      this.viewer.scene.pickPosition(evt.position, this.moveStart);
      this.dragStart = true;

      const normal = Ellipsoid.WGS84.geodeticSurfaceNormal(this.moveStart);
      this.movePlane = Plane.fromPointNormal(this.moveStart, normal);

      if (
        this.chosenModel?.id.tilesClipping ||
        this.chosenModel?.id.terrainClipping
      ) {
        removeClippingFrom3dTilesets(
          this.chosenModel,
          this.tiles3dCollection,
          this.viewer.scene.globe,
        );
      }
    }
  }
  onLeftUp(): void {
    if (this.grabType) {
      if (
        this.chosenModel?.id.tilesClipping ||
        this.chosenModel?.id.terrainClipping
      ) {
        updateModelClipping(
          this.chosenModel,
          this.tiles3dCollection,
          this.viewer.scene.globe,
        );
      }
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
      this.grabType = undefined;
    }
  }

  onMouseMove(evt: ScreenSpaceEventHandler.MotionEvent): void {
    if (this.cameraMoving) return;
    if (this.grabType && this.chosenModel) {
      const endPosition = this.viewer.scene.pickPosition(evt.endPosition);
      if (!endPosition) return;

      if (this.grabType === 'edge') {
        rotate(
          evt.startPosition,
          evt.endPosition,
          this.chosenModel.modelMatrix,
        );
        return;
      }
      if (this.grabType === 'corner') {
        scale(evt.startPosition, evt.endPosition, this.chosenModel.modelMatrix);
        return;
      }
      if (this.dragStart) {
        Cartesian3.subtract(
          endPosition,
          getTranslationFromMatrix(this.chosenModel.modelMatrix),
          this.pickedPointOffset,
        );
        this.dragStart = false;
      }

      const pickedPosition = Cartesian3.add(
        this.position,
        this.pickedPointOffset,
        new Cartesian3(),
      );

      if (this.grabType === 'top') {
        getVerticalMoveVector(
          this.viewer.scene,
          pickedPosition,
          evt.endPosition,
          this.chosenModel,
          this.moveStep,
        );
      } else if (this.grabType === 'side') {
        getHorizontalMoveVector(
          this.viewer.scene,
          pickedPosition,
          evt.endPosition,
          this.movePlane,
          this.moveStep,
        );
      }

      Cartesian3.add(this.position, this.moveStep, this.position);

      Matrix4.setTranslation(
        this.chosenModel.modelMatrix,
        this.position,
        this.chosenModel.modelMatrix,
      );

      return;
    }
    this.updateCursor(evt.endPosition);
  }

  updateCursor(position: Cartesian2): void {
    const obj: {id: Entity | undefined; primitive: Model | undefined} = <
      {id: Entity | undefined; primitive: Model | undefined}
    >this.viewer.scene.pick(position);
    if (!obj) return;

    const pickedEntity =
      this.chosenModel && obj?.id && obj.id instanceof Entity
        ? obj?.id
        : undefined;
    const model =
      !pickedEntity &&
      obj?.primitive &&
      this.primitiveCollection.contains(obj.primitive)
        ? obj.primitive
        : undefined;
    if (!pickedEntity && !model) return;

    const isEdge =
      pickedEntity && this.edgeLinesDataSource.entities.contains(pickedEntity);
    if (model && !this.chosenModel) {
      if (this.cursor !== 'pointer') {
        this.viewer.canvas.style.cursor = this.cursor = 'pointer';
      }
    } else if (
      pickedEntity &&
      this.sidePlanesDataSource.entities.contains(pickedEntity)
    ) {
      if (this.cursor !== 'move') {
        this.viewer.canvas.style.cursor = this.cursor = 'move';
      }
    } else if (
      pickedEntity &&
      this.topDownPlanesDataSource.entities.contains(pickedEntity)
    ) {
      if (this.cursor !== 'ns-resize') {
        this.viewer.canvas.style.cursor = this.cursor = 'ns-resize';
      }
    } else if (
      pickedEntity &&
      this.cornerPointsDataSource.entities.contains(pickedEntity)
    ) {
      if (this.cursor !== 'nesw-resize') {
        this.viewer.canvas.style.cursor = this.cursor = 'nesw-resize';
      }
    } else if (isEdge) {
      if (this.cursor !== 'ew-resize') {
        this.viewer.canvas.style.cursor = this.cursor = 'ew-resize';
      }
      if (!this.hoveredEdge) {
        this.hoveredEdge = pickedEntity;
        this.hoveredEdge.polyline.material = new ColorMaterialProperty(
          Color.WHITE.withAlpha(0.9),
        );
      }
    } else if (this.cursor !== 'default') {
      this.viewer.canvas.style.cursor = this.cursor = 'default';
    }
    if (this.hoveredEdge && !isEdge) {
      this.hoveredEdge.polyline.material = new ColorMaterialProperty(
        Color.WHITE.withAlpha(0.3),
      );
      this.hoveredEdge = undefined;
    }
  }

  pickModel(position: Cartesian2): Model | undefined {
    const pickedObject: {primitive: Model | undefined} = <
      {primitive: Model | undefined}
    >this.viewer.scene.pick(position);
    return pickedObject?.primitive &&
      this.primitiveCollection.contains(pickedObject.primitive)
      ? pickedObject.primitive
      : undefined;
  }

  pickGrabType(position: Cartesian2): GrabType | undefined {
    const pickedObject: {id: Entity | undefined} = <{id: Entity | undefined}>(
      this.viewer.scene.pick(position)
    );
    if (!pickedObject?.id?.id) return undefined;
    if (this.sidePlanesDataSource.entities.contains(pickedObject.id)) {
      return 'side';
    } else if (
      this.topDownPlanesDataSource.entities.contains(pickedObject.id)
    ) {
      return 'top';
    } else if (this.edgeLinesDataSource.entities.contains(pickedObject.id)) {
      return 'edge';
    } else if (this.cornerPointsDataSource.entities.contains(pickedObject.id)) {
      return 'corner';
    }
    return undefined;
  }

  initDataSources(): void {
    this.dataSourceCollection
      .add(new CustomDataSource())
      .then((dataSource) => (this.sidePlanesDataSource = dataSource))
      .catch((e) => console.error(e));
    this.dataSourceCollection
      .add(new CustomDataSource())
      .then((dataSource) => (this.topDownPlanesDataSource = dataSource))
      .catch((e) => console.error(e));
    this.dataSourceCollection
      .add(new CustomDataSource())
      .then((dataSource) => (this.edgeLinesDataSource = dataSource))
      .catch((e) => console.error(e));
    this.dataSourceCollection
      .add(new CustomDataSource())
      .then((dataSource) => (this.cornerPointsDataSource = dataSource))
      .catch((e) => console.error(e));
  }

  async initModelsAndEvents(): Promise<void> {
    const models = this.storeOptions
      ? getStoredModels(this.storeOptions.localStoreKey)
      : undefined;
    if (models?.length) {
      await Promise.all(
        models.map(async (m: StoredModel) => {
          const blob = await getBlobFromIndexedDB(
            this.storeOptions.indexDbName,
            m.name,
          );
          const model: INGVCesiumModel = await instantiateModel({
            type: 'model',
            options: {
              url: URL.createObjectURL(blob),
              scene: this.viewer.scene,
              modelMatrix: Matrix4.fromTranslationRotationScale(
                new TranslationRotationScale(
                  new Cartesian3(...m.translation),
                  new Quaternion(...m.rotation),
                  new Cartesian3(...m.scale),
                ),
              ),
              id: {
                name: m.name,
                dimensions: new Cartesian3(...Object.values(m.dimensions)),
                terrainClipping: m.terrainClipping,
                tilesClipping: m.tilesClipping,
              },
            },
          });
          this.primitiveCollection.add(model);
          model.readyEvent.addEventListener(() =>
            updateModelClipping(
              model,
              this.tiles3dCollection,
              this.viewer.scene.globe,
            ),
          );
        }),
      );
      this.onPrimitivesChanged();
      this.initEvents();
      this.viewer.scene.requestRender();
    } else {
      this.initEvents();
    }
  }

  firstUpdated(_changedProperties: PropertyValues): void {
    this.initModelsAndEvents().catch((e) => console.error(e));
    this.initDataSources();
    super.firstUpdated(_changedProperties);
  }

  protected shouldUpdate(): boolean {
    return !!this.viewer && !!this.primitiveCollection;
  }
  render(): HTMLTemplateResult | string {
    if (!this.chosenModel && !this.models?.length) return '';
    return this.chosenModel
      ? html` <ngv-layer-details
          .layer="${{
            name: this.chosenModel.id.name,
            clippingOptions: {
              terrainClipping: this.chosenModel.id.terrainClipping,
              tilesClipping: this.chosenModel.id.tilesClipping,
            },
          }}"
          .showDone=${true}
          @clippingChange=${(evt: {detail: ClippingChangeDetail}) => {
            this.chosenModel.id.terrainClipping = evt.detail.terrainClipping;
            this.chosenModel.id.tilesClipping = evt.detail.tilesClipping;
            updateModelClipping(
              this.chosenModel,
              this.tiles3dCollection,
              this.viewer.scene.globe,
            );
          }}
          @done="${() => {
            this.chosenModel = undefined;
            this.sidePlanesDataSource.entities.removeAll();
            this.topDownPlanesDataSource.entities.removeAll();
            this.edgeLinesDataSource.entities.removeAll();
            this.cornerPointsDataSource.entities.removeAll();
            this.onPrimitivesChanged();
          }}"
        ></ngv-layer-details>`
      : html` <ngv-layers-list
          .options="${{
            title: this.options?.listTitle,
            showDeleteBtns: true,
            showZoomBtns: true,
          }}"
          .layers=${this.models.map((m) => {
            return {name: m.id.name};
          })}
          @remove="${(evt: {detail: number}) => {
            const model = this.primitiveCollection.get(
              evt.detail,
            ) as INGVCesiumModel;
            if (model) this.primitiveCollection.remove(model);
          }}"
          @zoom="${(evt: {detail: number}) => {
            const model = this.primitiveCollection.get(
              evt.detail,
            ) as INGVCesiumModel;
            this.viewer.camera.flyToBoundingSphere(model.boundingSphere, {
              duration: 2,
            });
          }}"
        ></ngv-layers-list>`;
  }

  disconnectedCallback(): void {
    this.removeEvents();
    super.disconnectedCallback();
  }
}
