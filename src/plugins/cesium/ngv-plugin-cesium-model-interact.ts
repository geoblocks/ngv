import {css, html, LitElement} from 'lit';
import type {HTMLTemplateResult, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {
  CesiumWidget,
  DataSource,
  Model,
  PrimitiveCollection,
  Entity,
  DataSourceCollection,
  Scene,
} from '@cesium/engine';
import {
  Axis,
  Cartesian3,
  Color,
  Matrix4,
  Plane,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  Cartographic,
  Cartesian2,
  Quaternion,
  Matrix3,
  CustomDataSource,
  CallbackProperty,
  Ellipsoid,
  IntersectionTests,
  Ray,
  JulianDate,
  BoundingSphere,
  ArcType,
  TranslationRotationScale,
  HeadingPitchRoll,
} from '@cesium/engine';

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

const FACE_POINT_VECTORS = [
  new Cartesian3(0.5, 0.0, 0.0),
  new Cartesian3(0.0, 0.5, 0.0),
  new Cartesian3(0.0, 0.0, 0.5),
];

type GrabType = 'side' | 'top' | 'edge' | undefined;

@customElement('ngv-plugin-cesium-model-interact')
export class NgvPluginCesiumModelInteract extends LitElement {
  @property({type: Object})
  private viewer: CesiumWidget;
  @property({type: Object})
  private primitiveCollection: PrimitiveCollection;
  @property({type: Object})
  private dataSourceCollection: DataSourceCollection;
  @state()
  private cursor: 'default' | 'grab' | 'grabbing' | 'pointer' = 'default';
  @state()
  private chosenModel: Model | undefined;
  @state()
  private position: Cartesian3 = new Cartesian3();
  private eventHandler: ScreenSpaceEventHandler | undefined;
  private sidePlanesDataSource: DataSource | undefined;
  private topDownPlanesDataSource: DataSource | undefined;
  private edgeLinesDataSource: DataSource | undefined;
  private moveStart: Cartesian3 = new Cartesian3();
  private moveStep: Cartesian3 = new Cartesian3();
  private pickedPointOffset: Cartesian3 = new Cartesian3();
  private dragStart: boolean = false;
  private movePlane: Plane | undefined;
  private grabType: GrabType;

  // todo move in UI plugin
  static styles = css`
    .model-info-overlay {
      position: absolute;
      background-color: white;
      display: flex;
      flex-direction: column;
      z-index: 1;
      margin-left: auto;
      margin-right: auto;
      top: 10%;
      left: 10%;
      transform: translate(-10%, -10%);
      padding: 10px;
      gap: 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
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
      margin-right: 16px;
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
      (evt: ScreenSpaceEventHandler.PositionedEvent) => this.onLeftUp(evt),
      ScreenSpaceEventType.LEFT_UP,
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

  createPlaneEntity(planeLocal: Plane, model: Model, color: Color) {
    const modelMatrix = model.modelMatrix;

    const normalAxis = planeLocal.normal.x
      ? Axis.X
      : planeLocal.normal.y
        ? Axis.Y
        : Axis.Z;
    const planeDimensions = new Cartesian2();
    const dimensions: Cartesian3 = model.id.dimensions;
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
    const plane = Plane.transform(planeLocal, scaleMatrix);

    const dataSource =
      normalAxis === Axis.Z
        ? this.topDownPlanesDataSource
        : this.sidePlanesDataSource;

    dataSource.entities.add({
      position: new CallbackProperty(
        () => this.chosenModel.boundingSphere.center,
        false,
      ),
      orientation: Quaternion.fromRotationMatrix(
        Matrix4.getRotation(modelMatrix, new Matrix3()),
      ),
      plane: {
        plane: plane,
        dimensions: planeDimensions,
        material: color.withAlpha(0.5),
        outline: true,
        outlineColor: Color.WHITE,
      },
    });
  }

  async onClick(evt: ScreenSpaceEventHandler.PositionedEvent): Promise<void> {
    const model: Model | undefined = this.pickModel(evt.position);
    if (model) {
      if (!this.chosenModel) {
        this.chosenModel = model;
        Cartesian3.add(
          Cartesian3.ZERO,
          Matrix4.getTranslation(
            this.chosenModel.modelMatrix,
            new Cartesian3(),
          ),
          this.position,
        );
        const centerDiff = Cartesian3.subtract(
          model.boundingSphere.center,
          this.position,
          new Cartesian3(),
        );
        SIDE_PLANES.forEach((p) => this.createPlaneEntity(p, model, Color.RED));

        const localEdges: [Cartesian3, Cartesian3][] = [];
        CORNER_POINT_VECTORS.forEach((vector, i) => {
          const upPoint = vector;
          const downPoint = Cartesian3.clone(upPoint, new Cartesian3());
          downPoint.z *= -1;

          const nextUpPoint = CORNER_POINT_VECTORS[(i + 1) % 4];
          const nextDownPoint = Cartesian3.clone(nextUpPoint, new Cartesian3());
          nextDownPoint.z *= -1;

          const verticalEdge: [Cartesian3, Cartesian3] = [upPoint, downPoint];
          const topEdge: [Cartesian3, Cartesian3] = [nextUpPoint, upPoint];
          const bottomEdge: [Cartesian3, Cartesian3] = [
            nextDownPoint,
            downPoint,
          ];
          localEdges.push(verticalEdge, topEdge, bottomEdge);
        });
        localEdges.forEach((localEdge) => {
          const positions = [new Cartesian3(), new Cartesian3()];
          this.edgeLinesDataSource.entities.add({
            polyline: {
              show: true,
              positions: new CallbackProperty(() => {
                // todo improve
                const modelMatrix = model.modelMatrix;
                const matrix = Matrix4.fromTranslationRotationScale(
                  new TranslationRotationScale(
                    Matrix4.getTranslation(modelMatrix, new Cartesian3()),
                    Quaternion.fromRotationMatrix(
                      Matrix4.getRotation(modelMatrix, new Matrix3()),
                    ),
                    this.chosenModel.id.dimensions,
                  ),
                );
                Cartesian3.add(
                  Matrix4.multiplyByPoint(matrix, localEdge[0], positions[0]),
                  centerDiff,
                  positions[0],
                );
                Cartesian3.add(
                  Matrix4.multiplyByPoint(matrix, localEdge[1], positions[1]),
                  centerDiff,
                  positions[1],
                );
                return positions;
              }, false),
              width: 2,
              material: Color.WHITE,
              arcType: ArcType.NONE,
            },
          });
        });
      }
    }
  }

  onLeftDown(evt: ScreenSpaceEventHandler.PositionedEvent): void {
    this.grabType = this.pickGrabType(evt.position);
    if (this.grabType && this.cursor !== 'grabbing') {
      this.viewer.canvas.style.cursor = this.cursor = 'grabbing';
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
      this.viewer.scene.pickPosition(evt.position, this.moveStart);
      this.dragStart = true;

      const normal = Ellipsoid.WGS84.geodeticSurfaceNormal(this.moveStart);
      this.movePlane = Plane.fromPointNormal(this.moveStart, normal);
    }
  }
  onLeftUp(): void {
    if (this.cursor === 'grabbing') {
      this.viewer.canvas.style.cursor = this.cursor = 'grab';
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
        hpr.pitch = 0;
        hpr.roll = 0;

        const quaternion = new Quaternion();
        Quaternion.multiply(
          Quaternion.fromRotationMatrix(
            Matrix4.getRotation(this.chosenModel.modelMatrix, new Matrix3()),
            quaternion,
          ),
          Quaternion.fromHeadingPitchRoll(hpr),
          quaternion,
        );

        this.chosenModel.modelMatrix = Matrix4.fromTranslationRotationScale(
          new TranslationRotationScale(
            Matrix4.getTranslation(
              this.chosenModel.modelMatrix,
              new Cartesian3(),
            ),
            quaternion,
            Matrix4.getScale(this.chosenModel.modelMatrix, new Cartesian3()),
          ),
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
        //   Cartesian3.fromRadians(
        //   cartPickedPosition.longitude,
        //   cartPickedPosition.latitude,
        //   cartPickedPosition.height + this.chosenModel.id.max.y,
        // );
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

      this.chosenModel.modelMatrix = Transforms.eastNorthUpToFixedFrame(
        this.position,
      );
      return;
    }

    const model: Model | undefined = this.pickModel(evt.endPosition);
    if (this.grabType || model) {
      if (this.cursor !== 'pointer' && !this.chosenModel) {
        this.viewer.canvas.style.cursor = this.cursor = 'pointer';
      } else if (this.chosenModel) {
        if (this.cursor !== 'grab' && this.cursor !== 'grabbing') {
          this.viewer.canvas.style.cursor = this.cursor = 'grab';
        }
      }
    } else {
      if (this.cursor !== 'default') {
        this.viewer.canvas.style.cursor = this.cursor = 'default';
      }
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

  pickGrabType(position: Cartesian2): GrabType {
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
    }
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this.initEvents();
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
    super.firstUpdated(_changedProperties);
  }

  protected shouldUpdate(): boolean {
    return !!this.viewer && !!this.primitiveCollection;
  }
  render(): HTMLTemplateResult | string {
    if (!this.chosenModel) return '';
    // todo move in UI plugin
    return html` <div class="model-info-overlay">
      ${JSON.stringify(this.position)}
      <button
        @click="${() => {
          this.chosenModel = undefined;
          this.sidePlanesDataSource.entities.removeAll();
          this.topDownPlanesDataSource.entities.removeAll();
          this.edgeLinesDataSource.entities.removeAll();
        }}"
      >
        Done
      </button>
    </div>`;
  }

  disconnectedCallback(): void {
    this.removeEvents();
    super.disconnectedCallback();
  }
}
