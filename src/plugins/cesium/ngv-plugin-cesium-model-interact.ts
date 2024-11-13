import {css, html, LitElement} from 'lit';
import type {HTMLTemplateResult, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {
  CesiumWidget,
  DataSource,
  PrimitiveCollection,
  DataSourceCollection,
} from '@cesium/engine';
import {
  Model,
  Axis,
  Cartesian3,
  Color,
  Matrix4,
  Plane,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Cartesian2,
  Quaternion,
  Matrix3,
  CustomDataSource,
  CallbackProperty,
  Ellipsoid,
  IntersectionTests,
  Ray,
  ArcType,
  TranslationRotationScale,
  HeadingPitchRoll,
  Entity,
  ColorMaterialProperty,
} from '@cesium/engine';
import {instantiateModel} from './ngv-cesium-factories.js';
import type {StoredModel} from '../../apps/permits/localStore.js';
import {
  deleteFromIndexedDB,
  getBlobFromIndexedDB,
  getStoredModels,
  updateModelsInLocalStore,
} from '../../apps/permits/localStore.js';
import type {UploadedModel} from './ngv-plugin-cesium-upload.js';

const SIDE_PLANES: Plane[] = [
  new Plane(new Cartesian3(0, 0, 1), 0.5),
  new Plane(new Cartesian3(0, 0, -1), 0.5),
  new Plane(new Cartesian3(0, 1, 0), 0.5),
  new Plane(new Cartesian3(0, -1, 0), 0.5),
  new Plane(new Cartesian3(1, 0, 0), 0.5),
  new Plane(new Cartesian3(-1, 0, 0), 0.5),
];

const CORNER_POINT_VECTORS = [
  new Cartesian3(0.5, 0.5, 0.5),
  new Cartesian3(0.5, -0.5, 0.5),
  new Cartesian3(-0.5, -0.5, 0.5),
  new Cartesian3(-0.5, 0.5, 0.5),
];

const LOCAL_EDGES: [Cartesian3, Cartesian3][] = [];
CORNER_POINT_VECTORS.forEach((vector, i) => {
  const upPoint = vector;
  const downPoint = Cartesian3.clone(upPoint, new Cartesian3());
  downPoint.z *= -1;
  const nextUpPoint = CORNER_POINT_VECTORS[(i + 1) % 4];
  const nextDownPoint = Cartesian3.clone(nextUpPoint, new Cartesian3());
  nextDownPoint.z *= -1;
  const verticalEdge: [Cartesian3, Cartesian3] = [upPoint, downPoint];
  // const topEdge: [Cartesian3, Cartesian3] = [nextUpPoint, upPoint];
  // const bottomEdge: [Cartesian3, Cartesian3] = [nextDownPoint, downPoint];
  LOCAL_EDGES.push(verticalEdge);
});

type GrabType = 'side' | 'top' | 'edge' | 'corner' | undefined;

@customElement('ngv-plugin-cesium-model-interact')
export class NgvPluginCesiumModelInteract extends LitElement {
  @property({type: Object})
  private viewer: CesiumWidget;
  @property({type: Object})
  private primitiveCollection: PrimitiveCollection;
  @property({type: Object})
  private dataSourceCollection: DataSourceCollection;
  @state()
  private cursor:
    | 'default'
    | 'move'
    | 'pointer'
    | 'ns-resize'
    | 'ew-resize'
    | 'nesw-resize' = 'default';
  @state()
  private chosenModel: UploadedModel | undefined;
  @state()
  private position: Cartesian3 = new Cartesian3();
  @state()
  private models: UploadedModel[] = [];
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

  // todo move in UI plugin
  static styles = css`
    .model-list,
    .model-info {
      background-color: white;
      display: flex;
      flex-direction: column;
      z-index: 1;
      margin-left: auto;
      margin-right: auto;
      padding: 10px;
      gap: 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
    }

    .model-item {
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      column-gap: 10px;
    }

    .model-item span {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    button,
    input[type='text'] {
      border-radius: 4px;
      padding: 0 16px;
      height: 40px;
      cursor: pointer;
      background-color: white;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
      transition: background-color 200ms;
    }

    input[type='text'] {
      cursor: text;
    }
  `;

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

    this.primitiveCollection.primitiveAdded.addEventListener(() => {
      this.onPrimitivesChanged();
    });
    this.primitiveCollection.primitiveRemoved.addEventListener(
      (p: UploadedModel) => {
        deleteFromIndexedDB(p.id.name)
          .then(() => this.onPrimitivesChanged())
          .catch((e) => console.error(e));
      },
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
  }

  onPrimitivesChanged(): void {
    this.models = [];
    for (let i = 0; i < this.primitiveCollection.length; i++) {
      const model = this.primitiveCollection.get(i) as UploadedModel;
      if (model instanceof Model) {
        this.models.push(model);
      }
    }
    updateModelsInLocalStore(this.models);
  }

  createPlaneEntity(
    planeLocal: Plane,
    model: UploadedModel,
    color: Color,
  ): void {
    const normalAxis = planeLocal.normal.x
      ? Axis.X
      : planeLocal.normal.y
        ? Axis.Y
        : Axis.Z;

    const getDimensionsAndScale = () => {
      const planeDimensions = new Cartesian2();
      const dimensions: Cartesian3 = Cartesian3.clone(model.id.dimensions);
      Cartesian3.multiplyComponents(
        Matrix4.getScale(this.chosenModel.modelMatrix, new Cartesian3()),
        dimensions,
        dimensions,
      );
      let scale = new Cartesian3();

      if (normalAxis === Axis.X) {
        planeDimensions.x = dimensions.y;
        planeDimensions.y = dimensions.z;
        scale = new Cartesian3(dimensions.x, dimensions.y, dimensions.z);
      } else if (normalAxis === Axis.Y) {
        planeDimensions.x = dimensions.x;
        planeDimensions.y = dimensions.z;
        dimensions.clone(scale);
      } else if (normalAxis === Axis.Z) {
        planeDimensions.x = dimensions.x;
        planeDimensions.y = dimensions.y;
        scale = new Cartesian3(dimensions.y, dimensions.x, dimensions.z);
      }
      const scaleMatrix = Matrix4.fromScale(scale, new Matrix4());
      return {
        scaleMatrix,
        planeDimensions,
      };
    };

    const dataSource =
      normalAxis === Axis.Z
        ? this.topDownPlanesDataSource
        : this.sidePlanesDataSource;

    dataSource.entities.add({
      position: new CallbackProperty(
        () => this.chosenModel.boundingSphere.center,
        false,
      ),
      orientation: new CallbackProperty(
        () =>
          Quaternion.fromRotationMatrix(
            Matrix4.getRotation(this.chosenModel.modelMatrix, new Matrix3()),
          ),
        false,
      ),
      plane: {
        plane: new CallbackProperty(() => {
          const {scaleMatrix} = getDimensionsAndScale();
          return Plane.transform(planeLocal, scaleMatrix);
        }, false),
        dimensions: new CallbackProperty(() => {
          const {planeDimensions} = getDimensionsAndScale();
          return planeDimensions;
        }, false),
        material: color.withAlpha(0.5),
        outline: true,
        outlineColor: Color.WHITE,
      },
    });
  }

  createEdge(localEdge: Cartesian3[]): void {
    // todo improve
    const positions = [new Cartesian3(), new Cartesian3()];
    this.edgeLinesDataSource.entities.add({
      polyline: {
        show: true,
        positions: new CallbackProperty(() => {
          const modelMatrix = this.chosenModel.modelMatrix;
          const matrix = Matrix4.fromTranslationRotationScale(
            new TranslationRotationScale(
              Matrix4.getTranslation(modelMatrix, new Cartesian3()),
              Quaternion.fromRotationMatrix(
                Matrix4.getRotation(modelMatrix, new Matrix3()),
              ),
              Cartesian3.multiplyComponents(
                Matrix4.getScale(
                  this.chosenModel.modelMatrix,
                  new Cartesian3(),
                ),
                this.chosenModel.id.dimensions,
                new Cartesian3(),
              ),
            ),
          );
          Matrix4.multiplyByPoint(matrix, localEdge[0], positions[0]);
          Matrix4.multiplyByPoint(matrix, localEdge[1], positions[1]);
          const centerDiff = Cartesian3.subtract(
            this.chosenModel.boundingSphere.center,
            this.position,
            new Cartesian3(),
          );
          Cartesian3.add(positions[0], centerDiff, positions[0]);
          Cartesian3.add(positions[1], centerDiff, positions[1]);
          return positions;
        }, false),
        width: 10,
        material: Color.WHITE.withAlpha(0.3),
        arcType: ArcType.NONE,
      },
    });
  }

  createCornerPoint(localEdges: Cartesian3[]): void {
    // todo improve
    const position = new Cartesian3();
    localEdges.forEach((localEdge) => {
      this.cornerPointsDataSource.entities.add({
        position: new CallbackProperty(() => {
          const modelMatrix = this.chosenModel.modelMatrix;
          const matrix = Matrix4.fromTranslationRotationScale(
            new TranslationRotationScale(
              Matrix4.getTranslation(modelMatrix, new Cartesian3()),
              Quaternion.fromRotationMatrix(
                Matrix4.getRotation(modelMatrix, new Matrix3()),
              ),
              Cartesian3.multiplyComponents(
                Matrix4.getScale(
                  this.chosenModel.modelMatrix,
                  new Cartesian3(),
                ),
                this.chosenModel.id.dimensions,
                new Cartesian3(),
              ),
            ),
          );
          Matrix4.multiplyByPoint(matrix, localEdge, position);
          const centerDiff = Cartesian3.subtract(
            this.chosenModel.boundingSphere.center,
            this.position,
            new Cartesian3(),
          );
          Cartesian3.add(position, centerDiff, position);
          return position;
        }, false),
        ellipsoid: {
          show: true,
          radii: new Cartesian3(10, 10, 10),
          material: Color.BROWN,
        },
      });
    });
  }

  onClick(evt: ScreenSpaceEventHandler.PositionedEvent): void {
    const model: Model | undefined = this.pickModel(evt.position);
    if (model) {
      if (!this.chosenModel) {
        this.chosenModel = model;
        Matrix4.getTranslation(this.chosenModel.modelMatrix, this.position);
        SIDE_PLANES.forEach((p) => this.createPlaneEntity(p, model, Color.RED));
        LOCAL_EDGES.forEach((localEdge) => this.createEdge(localEdge));
        LOCAL_EDGES.forEach((localEdge) => this.createCornerPoint(localEdge));
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
    }
  }
  onLeftUp(): void {
    if (this.grabType) {
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
      this.grabType = undefined;
    }
  }

  onMouseMove(evt: ScreenSpaceEventHandler.MotionEvent): void {
    // todo split on smaller functions
    // todo add scratches
    if (this.grabType && this.chosenModel) {
      const endPosition = this.viewer.scene.pickPosition(evt.endPosition);
      if (!endPosition) return;

      if (this.grabType === 'edge') {
        const dx = evt.endPosition.x - evt.startPosition.x;
        const sensitivity = 0.05;
        const hpr = new HeadingPitchRoll();
        hpr.heading = -dx * sensitivity;

        const rotation = Matrix3.fromQuaternion(
          Quaternion.fromHeadingPitchRoll(hpr),
        );

        Matrix4.multiplyByMatrix3(
          this.chosenModel.modelMatrix,
          rotation,
          this.chosenModel.modelMatrix,
        );

        return;
      }
      if (this.grabType === 'corner') {
        const dx = evt.endPosition.x - evt.startPosition.x;
        const sensitivity = 0.01;
        const scaleAmount = 1 + dx * sensitivity;

        // Apply scale to the model matrix of the primitive
        const scaleMatrix = Matrix4.fromScale(
          new Cartesian3(scaleAmount, scaleAmount, scaleAmount),
        );
        Matrix4.multiply(
          this.chosenModel.modelMatrix,
          scaleMatrix,
          this.chosenModel.modelMatrix,
        );
        return;
      }
      if (this.dragStart) {
        Cartesian3.subtract(
          endPosition,
          Matrix4.getTranslation(
            this.chosenModel.modelMatrix,
            new Cartesian3(),
          ),
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
        const cartPickedPosition = Cartographic.fromCartesian(pickedPosition);
        const topPos = pickedPosition.clone();
        const bottomPos = Cartesian3.fromRadians(
          cartPickedPosition.longitude,
          cartPickedPosition.latitude,
          cartPickedPosition.height - this.chosenModel.id.dimensions.y,
        );
        const top2d = this.viewer.scene.cartesianToCanvasCoordinates(
          topPos,
          new Cartesian2(),
        );
        const bottom2d = this.viewer.scene.cartesianToCanvasCoordinates(
          bottomPos,
          new Cartesian2(),
        );
        const axis2D = Cartesian2.subtract(top2d, bottom2d, new Cartesian2());
        const scratchMouseMoveVector = Cartesian2.subtract(
          evt.endPosition,
          top2d,
          new Cartesian2(),
        );
        const scalar2d =
          Cartesian2.dot(scratchMouseMoveVector, axis2D) /
          Cartesian2.dot(axis2D, axis2D);

        const pixelSize = this.viewer.scene.camera.getPixelSize(
          this.chosenModel.boundingSphere,
          this.viewer.scene.drawingBufferWidth,
          this.viewer.scene.drawingBufferHeight,
        );
        const scalar3d =
          pixelSize * scalar2d * this.chosenModel.id.dimensions.y;

        const upDirection = Cartesian3.normalize(
          this.position,
          new Cartesian3(),
        );
        Cartesian3.multiplyByScalar(upDirection, scalar3d, this.moveStep);
      } else if (this.grabType === 'side') {
        const cameraRay = this.viewer.scene.camera.getPickRay(
          evt.endPosition,
          new Ray(),
        );
        if (!cameraRay) {
          return;
        }
        const nextPosition = IntersectionTests.rayPlane(
          cameraRay,
          this.movePlane,
        );

        if (!nextPosition) {
          return;
        }

        Cartesian3.subtract(nextPosition, pickedPosition, this.moveStep);
      }

      Cartesian3.add(this.position, this.moveStep, this.position);

      Matrix4.fromTranslationRotationScale(
        new TranslationRotationScale(
          this.position,
          Quaternion.fromRotationMatrix(
            Matrix4.getRotation(this.chosenModel.modelMatrix, new Matrix3()),
          ),
          Matrix4.getScale(this.chosenModel.modelMatrix, new Cartesian3()),
        ),
        this.chosenModel.modelMatrix,
      );
      return;
    }
    this.updateCursor(evt.endPosition);
  }

  updateCursor(position: Cartesian2): void {
    const model: Model | undefined = this.pickModel(position);
    const isSidePlane = !!this.pickEntity(position, this.sidePlanesDataSource);
    const isTopPlane = !!this.pickEntity(
      position,
      this.topDownPlanesDataSource,
    );
    const edgeEntity = this.pickEntity(position, this.edgeLinesDataSource);
    const isCorner = !!this.pickEntity(position, this.cornerPointsDataSource);
    if (model && !this.chosenModel) {
      if (this.cursor !== 'pointer') {
        this.viewer.canvas.style.cursor = this.cursor = 'pointer';
      }
    } else if (isSidePlane) {
      if (this.cursor !== 'move') {
        this.viewer.canvas.style.cursor = this.cursor = 'move';
      }
    } else if (isTopPlane) {
      if (this.cursor !== 'ns-resize') {
        this.viewer.canvas.style.cursor = this.cursor = 'ns-resize';
      }
    } else if (isCorner) {
      if (this.cursor !== 'nesw-resize') {
        this.viewer.canvas.style.cursor = this.cursor = 'nesw-resize';
      }
    } else if (edgeEntity) {
      if (this.cursor !== 'ew-resize') {
        this.viewer.canvas.style.cursor = this.cursor = 'ew-resize';
      }
      if (!this.hoveredEdge) {
        this.hoveredEdge = edgeEntity;
        this.hoveredEdge.polyline.material = new ColorMaterialProperty(
          Color.WHITE.withAlpha(0.9),
        );
      }
    } else if (this.cursor !== 'default') {
      this.viewer.canvas.style.cursor = this.cursor = 'default';
    }
    if (this.hoveredEdge && !edgeEntity) {
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

  pickEntity(position: Cartesian2, dataSource: DataSource): Entity | undefined {
    const obj: {id: Entity | undefined} = <{id: Entity | undefined}>(
      this.viewer.scene.pick(position)
    );
    return obj?.id &&
      obj.id instanceof Entity &&
      dataSource.entities.contains(obj.id)
      ? obj?.id
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

  firstUpdated(_changedProperties: PropertyValues): void {
    // todo improve code
    const models = getStoredModels();
    if (models) {
      Promise.all(
        models.map(async (m: StoredModel) => {
          const blob = await getBlobFromIndexedDB(m.name);
          const model = await instantiateModel({
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
              },
            },
          });
          this.primitiveCollection.add(model);
        }),
      )
        .then(() => {
          this.onPrimitivesChanged();
          this.initEvents();
          this.viewer.scene.requestRender();
        })
        .catch((e) => console.error(e));
    } else {
      this.initEvents();
    }
    // todo improve
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
    super.firstUpdated(_changedProperties);
  }

  protected shouldUpdate(): boolean {
    return !!this.viewer && !!this.primitiveCollection;
  }
  render(): HTMLTemplateResult | string {
    if (!this.chosenModel && !this.models?.length) return '';
    // todo move in UI plugin
    return this.chosenModel
      ? html` <div class="model-info">
          ${this.chosenModel.id.name}
          <button
            @click="${() => {
              this.chosenModel = undefined;
              this.sidePlanesDataSource.entities.removeAll();
              this.topDownPlanesDataSource.entities.removeAll();
              this.edgeLinesDataSource.entities.removeAll();
              this.cornerPointsDataSource.entities.removeAll();
              this.onPrimitivesChanged();
            }}"
          >
            Done
          </button>
        </div>`
      : html` <p>Uploaded models:</p>
          <div class="model-list">
            ${this.models.map(
              (m) =>
                html`<div class="model-item">
                  <span>${m.id.name}</span>
                  <button
                    @click=${() => {
                      this.primitiveCollection.remove(m);
                    }}
                  >
                    &#x2718;
                  </button>
                </div>`,
            )}
          </div>`;
  }

  disconnectedCallback(): void {
    this.removeEvents();
    super.disconnectedCallback();
  }
}
