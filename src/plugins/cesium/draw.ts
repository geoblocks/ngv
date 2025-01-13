import type {
  CesiumWidget,
  ConstantProperty,
  CustomDataSource,
  LabelGraphics,
} from '@cesium/engine';
import {
  EllipsoidGeodesic,
  PositionProperty,
  Entity,
  ConstantPositionProperty,
  HorizontalOrigin,
  LabelStyle,
  VerticalOrigin,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  ClassificationType,
  Color,
  HeightReference,
  Intersections2D,
  JulianDate,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from '@cesium/engine';
import earcut from 'earcut';
import {updateHeightForCartesianPositions} from './interactionHelpers.js';

type PointOptions = {
  color?: Color;
  virtualColor?: Color;
  outlineWidth?: number;
  outlineColor?: Color;
  pixelSizeDefault?: number;
  pixelSizeEdit?: number;
  heightReference?: HeightReference;
};
export interface DrawOptions {
  fillColor?: string | Color;
  strokeColor?: string | Color;
  strokeWidth?: number;
  minPointsStop?: boolean;
  pointOptions?: Omit<
    PointOptions,
    'color' | 'virtualColor' | 'outlineColor'
  > & {
    color?: Color | string;
    virtualColor?: Color | string;
    outlineColor?: Color | string;
  };
  lineClampToGround?: boolean;
}

export type SegmentInfo = {
  length: number;
  eastingDiff: number;
  northingDiff: number;
  heightDiff: number;
};
export type DrawInfo = {
  length: number;
  numberOfSegments: number;
  segments: SegmentInfo[];
  type: GeometryTypes;
  drawInProgress: boolean;
  area?: number;
};

export type DrawEndDetails = {
  positions: Cartesian3[];
  type: GeometryTypes;
  measurements: Measurements;
};

export type GeometryTypes = 'point' | 'line' | 'rectangle' | 'polygon';

export class CesiumDraw extends EventTarget {
  private readonly viewer_: CesiumWidget;
  private readonly strokeColor_: Color;
  private readonly strokeWidth_: number;
  private readonly fillColor_: Color;
  private eventHandler_: ScreenSpaceEventHandler | undefined;
  private activePoints_: Cartesian3[] = [];
  private activePoint_: Cartesian3 | undefined;
  private sketchPoint_: Entity | undefined;
  private activeDistance_ = 0;
  private activeDistancePoly_ = 0;
  private activeDistances_: number[] = [];
  private leftPressedPixel_: Cartesian2 | undefined;
  private sketchPoints_: Entity[] = [];
  private isDoubleClick = false;
  private singleClickTimer: NodeJS.Timeout | null = null;
  private segmentsInfo: SegmentInfo[] = [];
  private julianDate = new JulianDate();
  type: GeometryTypes | undefined;
  drawingDataSource: CustomDataSource;
  minPointsStop: boolean;
  moveEntity = false;
  entityForEdit: Entity | undefined;
  ERROR_TYPES = {needMorePoints: 'need_more_points'};
  pointOptions: PointOptions;
  // todo line options?
  lineClampToGround: boolean = true;

  constructor(
    viewer: CesiumWidget,
    dataSource: CustomDataSource,
    options?: DrawOptions,
  ) {
    super();
    // todo move default values to constants
    this.viewer_ = viewer;
    this.drawingDataSource = dataSource;
    this.strokeColor_ =
      options?.strokeColor instanceof Color
        ? options.strokeColor
        : Color.fromCssColorString(
            options?.strokeColor || 'rgba(0, 153, 255, 0.75)',
          );
    this.strokeWidth_ =
      options?.strokeWidth !== undefined ? options.strokeWidth : 4;
    this.fillColor_ =
      options?.fillColor instanceof Color
        ? options.fillColor
        : Color.fromCssColorString(
            options?.fillColor || 'rgba(0, 153, 255, 0.3)',
          );
    this.minPointsStop = !!options?.minPointsStop;
    this.lineClampToGround =
      typeof options?.lineClampToGround === 'boolean'
        ? options.lineClampToGround
        : true;
    const pointOptions = options?.pointOptions;
    const heightReference = pointOptions?.heightReference;
    this.pointOptions = {
      color:
        pointOptions?.color instanceof Color
          ? pointOptions.color
          : Color.fromCssColorString(pointOptions?.color || '#fff'),
      virtualColor:
        pointOptions?.virtualColor instanceof Color
          ? pointOptions.virtualColor
          : Color.fromCssColorString(pointOptions?.virtualColor || '#808080'),
      outlineColor:
        pointOptions?.outlineColor instanceof Color
          ? pointOptions.outlineColor
          : Color.fromCssColorString(pointOptions?.outlineColor || '#000'),
      outlineWidth:
        typeof pointOptions?.outlineWidth === 'number' &&
        !isNaN(pointOptions?.outlineWidth)
          ? pointOptions?.outlineWidth
          : 1,
      pixelSizeDefault:
        typeof pointOptions?.pixelSizeDefault === 'number' &&
        !isNaN(pointOptions?.pixelSizeDefault)
          ? pointOptions?.pixelSizeDefault
          : 5,
      pixelSizeEdit:
        typeof pointOptions?.pixelSizeEdit === 'number' &&
        !isNaN(pointOptions?.pixelSizeEdit)
          ? pointOptions?.pixelSizeEdit
          : 9,
      heightReference:
        typeof heightReference === 'number' && !isNaN(heightReference)
          ? heightReference
          : HeightReference.CLAMP_TO_GROUND,
    };
  }

  renderSceneIfTranslucent(): void {
    // because calling render decreases performance, only call it when needed.
    // see https://cesium.com/docs/cesiumjs-ref-doc/Scene.html#pickTranslucentDepth
    if (this.viewer_.scene.globe.translucency.enabled) {
      this.viewer_.scene.render();
    }
  }

  get active(): boolean {
    return this.eventHandler_ !== undefined;
  }

  set active(value: boolean) {
    // todo check for type
    if (value && this.type) {
      if (!this.eventHandler_) {
        this.eventHandler_ = new ScreenSpaceEventHandler(this.viewer_.canvas);
        if (this.entityForEdit) {
          this.activateEditing();
        } else {
          this.eventHandler_.setInputAction(
            this.onLeftClick.bind(this),
            ScreenSpaceEventType.LEFT_CLICK,
          );
          this.eventHandler_.setInputAction(
            this.onDoubleClick_.bind(this),
            ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
          );
        }
        this.eventHandler_.setInputAction(
          this.onMouseMove_.bind(this),
          ScreenSpaceEventType.MOUSE_MOVE,
        );
      }
      this.dispatchEvent(
        new CustomEvent<DrawInfo>('drawinfo', {
          detail: {
            length: 0,
            numberOfSegments: 0,
            segments: [],
            type: this.type,
            drawInProgress: true,
          },
        }),
      );
    } else {
      if (this.eventHandler_) {
        this.eventHandler_.destroy();
        this.eventHandler_ = undefined;
      }
    }
    this.dispatchEvent(
      new CustomEvent('statechanged', {detail: {active: value && this.type}}),
    );
  }

  activateEditing(): void {
    if (!this.eventHandler_ || !this.entityForEdit) return;
    this.eventHandler_.setInputAction(
      (event: ScreenSpaceEventHandler.PositionedEvent) =>
        this.onLeftDown_(event),
      ScreenSpaceEventType.LEFT_DOWN,
    );
    this.eventHandler_.setInputAction(
      (event: ScreenSpaceEventHandler.PositionedEvent) => this.onLeftUp_(event),
      ScreenSpaceEventType.LEFT_UP,
    );
    const position = this.entityForEdit.position?.getValue(this.julianDate);
    let positions: Cartesian3[] = [];
    let createVirtualSPs = false;
    switch (this.type) {
      case 'point':
        // todo
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        this.entityForEdit.position = new CallbackProperty(
          () => this.activePoints_[0] || position,
          false,
        );
        break;
      case 'line':
        positions = [
          ...(<Cartesian3[]>(
            this.entityForEdit.polyline.positions.getValue(this.julianDate)
          )),
        ];
        this.entityForEdit.polyline.positions = new CallbackProperty(
          () => this.activePoints_,
          false,
        );
        createVirtualSPs = true;
        break;
      case 'polygon':
        positions = [
          ...(<PolygonHierarchy>(
            this.entityForEdit.polygon.hierarchy.getValue(this.julianDate)
          )).positions,
        ];
        this.entityForEdit.polygon.hierarchy = new CallbackProperty(
          () => new PolygonHierarchy(this.activePoints_),
          false,
        );
        createVirtualSPs = true;
        break;
      case 'rectangle':
        positions = [
          ...(<PolygonHierarchy>(
            this.entityForEdit.polygon.hierarchy.getValue(this.julianDate)
          )).positions,
        ];
        this.entityForEdit.polygon.hierarchy = new CallbackProperty(
          () => new PolygonHierarchy(this.activePoints_),
          false,
        );
        this.drawingDataSource.entities.add({
          position: new CallbackProperty(() => {
            positions = this.activePoints_.length
              ? this.activePoints_
              : positions;
            return Cartesian3.midpoint(
              positions[0],
              positions[1],
              new Cartesian3(),
            );
          }, false),
          billboard: {
            image: '../../icons/rotate-icon.svg',
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: HeightReference.CLAMP_TO_GROUND,
          },
          properties: {
            type: 'rotate',
          },
        });
        break;
      default:
        break;
    }

    positions.forEach((p: Cartesian3, idx: number): void => {
      this.activePoints_.push(p);
      const sketchPoint = this.createSketchPoint_(p, {
        edit: true,
        positionIndex: idx,
      });
      sketchPoint.properties.index = idx;
      this.sketchPoints_.push(sketchPoint);
      if (createVirtualSPs && idx + 1 < positions.length) {
        const p2 = this.halfwayPosition_(p, positions[idx + 1]);
        const virtualSketchPoint = this.createSketchPoint_(p2, {
          edit: true,
          virtual: true,
        });
        virtualSketchPoint.properties.index = idx;
        this.sketchPoints_.push(virtualSketchPoint);
      }
    });
    if (this.type === 'polygon' && positions.length > 2) {
      // We need one more virtual sketchpoint for polygons
      const lastIdx = positions.length - 1;
      const p2 = this.halfwayPosition_(positions[lastIdx], positions[0]);
      const virtualSketchPoint = this.createSketchPoint_(p2, {
        edit: true,
        virtual: true,
      });
      virtualSketchPoint.properties.index = lastIdx;
      this.sketchPoints_.push(virtualSketchPoint);
    }
    this.viewer_.scene.requestRender();
  }

  finishDrawing(): void {
    let positions = this.activePoints_;
    if (
      (this.type === 'polygon' || this.type === 'rectangle') &&
      positions.length < 3
    ) {
      this.dispatchEvent(
        new CustomEvent('drawerror', {
          detail: {
            error: this.ERROR_TYPES.needMorePoints,
          },
        }),
      );
      return;
    }
    if (this.type === 'point') {
      positions.push(this.activePoint_);
      this.drawShape_(this.activePoint_);
    } else if (this.type === 'rectangle') {
      positions = rectanglify(this.activePoints_);
      this.drawShape_(positions);
    } else {
      if (this.type === 'polygon') {
        const distance = Cartesian3.distance(
          this.activePoints_[this.activePoints_.length - 1],
          this.activePoints_[0],
        );
        this.activeDistances_.push(distance);
      }
      this.drawShape_(this.activePoints_);
    }
    this.viewer_.scene.requestRender();

    const measurements = getMeasurements(positions, this.type);
    const segments = this.getSegmentsInfo(this.activeDistances_);
    this.dispatchEvent(
      new CustomEvent<DrawInfo>('drawinfo', {
        detail: {
          length: measurements.perimeter,
          numberOfSegments: segments.length,
          segments: segments,
          type: this.type,
          drawInProgress: false,
          area: measurements.area,
        },
      }),
    );
    this.dispatchEvent(
      new CustomEvent<DrawEndDetails>('drawend', {
        detail: {
          positions: positions,
          type: this.type,
          measurements: measurements,
        },
      }),
    );

    this.removeSketches();
  }

  removeSketches(): void {
    this.drawingDataSource.entities.removeAll();

    this.activePoints_ = [];
    this.activePoint_ = undefined;
    this.sketchPoint_ = undefined;
    this.activeDistance_ = 0;
    this.activeDistancePoly_ = 0;
    this.activeDistances_ = [];
    this.entityForEdit = undefined;
    this.leftPressedPixel_ = undefined;
    this.moveEntity = false;
    this.sketchPoints_ = [];
    this.segmentsInfo = [];
  }

  clear(): void {
    this.removeSketches();
  }

  createSketchPoint_(
    position: Cartesian3 | CallbackProperty,
    options: {
      edit?: boolean;
      virtual?: boolean;
      positionIndex?: number;
      label?: boolean;
    } = {},
  ): Entity {
    const entity: Entity.ConstructorOptions = {
      position: position,
      point: {
        color: options.virtual
          ? this.pointOptions.virtualColor
          : this.pointOptions.color,
        outlineWidth: this.pointOptions.outlineWidth,
        outlineColor: this.pointOptions.outlineColor,
        pixelSize: options.edit
          ? this.pointOptions.pixelSizeEdit
          : this.pointOptions.pixelSizeDefault,
        heightReference: this.pointOptions.heightReference,
      },
      properties: {},
    };
    if (options.edit) {
      entity.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }
    if (options.label && this.type) {
      entity.label = getDimensionLabel({
        type: this.type,
        distances: this.activeDistances_,
        positions: [...this.activePoints_],
      });
      entity.label.heightReference = this.pointOptions.heightReference;
    }
    const pointEntity = this.drawingDataSource.entities.add(entity);
    pointEntity.properties.virtual = options.virtual;
    return pointEntity;
  }

  createSketchLine_(positions: Cartesian3[] | CallbackProperty): Entity {
    return this.drawingDataSource.entities.add({
      polyline: {
        positions: positions,
        clampToGround: this.lineClampToGround,
        width: this.strokeWidth_,
        material: this.strokeColor_,
        classificationType: this.lineClampToGround
          ? ClassificationType.TERRAIN
          : ClassificationType.BOTH,
      },
    });
  }

  drawShape_(positions: Cartesian3 | Cartesian3[] | undefined): void {
    if (!positions) return;
    if (this.type === 'point' && !Array.isArray(positions)) {
      this.drawingDataSource.entities.add({
        position: positions,
        point: {
          color: this.fillColor_,
          outlineWidth: 2,
          outlineColor: this.strokeColor_,
          pixelSize: this.strokeWidth_,
          heightReference: this.lineClampToGround
            ? HeightReference.CLAMP_TO_GROUND
            : HeightReference.NONE,
        },
      });
    } else if (this.type === 'line' && Array.isArray(positions)) {
      this.drawingDataSource.entities.add({
        position: positions[positions.length - 1],
        polyline: {
          positions: positions,
          clampToGround: this.lineClampToGround,
          width: this.strokeWidth_,
          material: this.strokeColor_,
          classificationType: this.lineClampToGround
            ? ClassificationType.TERRAIN
            : ClassificationType.BOTH,
        },
        label: getDimensionLabel({
          type: this.type,
          distances: this.activeDistances_,
        }),
      });
    } else if (
      (this.type === 'polygon' || this.type === 'rectangle') &&
      Array.isArray(positions)
    ) {
      this.drawingDataSource.entities.add({
        position: positions[positions.length - 1],
        polygon: {
          hierarchy: positions,
          material: this.fillColor_,
          classificationType: ClassificationType.TERRAIN,
        },
        label: getDimensionLabel({
          type: this.type,
          distances: this.activeDistances_,
          positions: [...this.activePoints_, this.activePoint_],
        }),
      });
    }
  }

  dynamicSketLinePositions(): CallbackProperty {
    return new CallbackProperty(() => {
      const activePoints: Cartesian3[] = [
        ...this.activePoints_,
        this.activePoint_,
      ];
      const positions =
        this.type === 'rectangle' ? rectanglify(activePoints) : activePoints;
      if (this.type === 'rectangle' && activePoints.length === 4) {
        // to avoid showing of confusing lines
        return [];
      }
      if (positions.length >= 3 && this.type !== 'line') {
        // close the polygon
        // FIXME: better memory management
        return [...positions, positions[0]];
      } else {
        return positions;
      }
    }, false);
  }

  updateSketchPoint(): void {
    if (!this.sketchPoint_) return;
    const activePoints: Cartesian3[] = [
      ...this.activePoints_,
      this.activePoint_,
    ];
    const positions =
      this.type === 'rectangle' ? rectanglify(activePoints) : activePoints;
    const pointsLength = positions.length;
    if (pointsLength > 1) {
      let distance;
      if (this.type === 'rectangle' && pointsLength > 2) {
        const b = positions[1]; //according to rectanglify
        const bp = positions[2];
        distance = Cartesian3.distance(b, bp);
        (<ConstantPositionProperty>this.sketchPoint_.position).setValue(bp);
      } else {
        const lastPoint = positions[pointsLength - 1];
        distance = Cartesian3.distance(positions[pointsLength - 2], lastPoint);
        (<ConstantPositionProperty>this.sketchPoint_.position).setValue(
          lastPoint,
        );
        if (this.type === 'polygon' && this.activePoints_.length > 1) {
          this.activeDistancePoly_ = Cartesian3.distance(
            lastPoint,
            positions[0],
          );
        }
      }
      this.activeDistance_ = distance;
      let area = 0;
      const distances = [...this.activeDistances_];
      if (this.type === 'polygon') {
        if (positions.length > 2) {
          distances.push(this.activeDistance_, this.activeDistancePoly_);
        }
        area = getPolygonArea(positions);
        (<ConstantProperty>this.sketchPoint_.label.text).setValue(
          `${area.toFixed(1)}m²`,
        );
      } else {
        const value = `${this.activeDistance_.toFixed(1)}m`;
        (<ConstantProperty>this.sketchPoint_.label.text).setValue(value);
      }
      this.segmentsInfo = this.getSegmentsInfo(distances);
      const numberOfSegments =
        this.type === 'polygon'
          ? this.segmentsInfo.length
          : this.segmentsInfo.length + 1;
      this.dispatchEvent(
        new CustomEvent<DrawInfo>('drawinfo', {
          detail: {
            length: this.activeDistance_,
            numberOfSegments:
              this.activePoints_.length === 0 ? 0 : numberOfSegments,
            segments: this.segmentsInfo,
            type: this.type,
            drawInProgress: true,
            area:
              this.type === 'polygon' || this.type === 'rectangle'
                ? area
                : undefined,
          },
        }),
      );
      return;
    }
    (<ConstantProperty>this.sketchPoint_.label.text).setValue('0m');
    this.dispatchEvent(
      new CustomEvent<DrawInfo>('drawinfo', {
        detail: {
          length: 0,
          numberOfSegments: 0,
          segments: [],
          type: this.type,
          drawInProgress: true,
        },
      }),
    );
  }

  onLeftClick(event: ScreenSpaceEventHandler.PositionedEvent): void {
    this.renderSceneIfTranslucent();
    if (!event?.position) return;
    const pickedPosition = this.viewer_.scene.pickPosition(event.position);
    if (pickedPosition) {
      const position = Cartesian3.clone(pickedPosition);
      if (!this.sketchPoint_) {
        this.dispatchEvent(new CustomEvent('drawstart'));
        this.sketchPoint_ = this.createSketchPoint_(position, {label: true});
        this.activePoint_ = position;

        this.createSketchLine_(this.dynamicSketLinePositions());
        this.viewer_.scene.requestRender();
        if (this.type === 'point') {
          this.activePoints_.push(position);
          this.finishDrawing();
          return;
        }
      } else if (!this.activeDistances_.includes(this.activeDistance_)) {
        this.activeDistances_.push(this.activeDistance_);
      }
      this.activePoints_.push(Cartesian3.clone(this.activePoint_));
      this.segmentsInfo = this.getSegmentsInfo(this.activeDistances_);
      const forceFinish =
        this.minPointsStop &&
        ((this.type === 'polygon' && this.activePoints_.length === 3) ||
          (this.type === 'line' && this.activePoints_.length === 2));
      if (
        (this.type === 'rectangle' && this.activePoints_.length === 3) ||
        forceFinish
      ) {
        this.finishDrawing();
      } else if (this.type === 'line') {
        if (!this.isDoubleClick) {
          if (this.singleClickTimer) {
            clearTimeout(this.singleClickTimer);
            this.singleClickTimer = null;
          } else {
            this.singleClickTimer = setTimeout(() => {
              this.isDoubleClick = false;
              const prevPoint = Cartesian3.clone(
                this.activePoints_[this.activePoints_.length - 1],
              );
              this.sketchPoints_.push(this.createSketchPoint_(prevPoint));
              this.singleClickTimer = null;
            }, 250);
          }
        }
      }
    }
  }

  updateRectCorner(
    corner: Cartesian3,
    oppositePoint: Cartesian3,
    midPoint: Cartesian3,
    midPointPrev: Cartesian3,
    midScale: number,
    negate: boolean,
  ): Cartesian3 {
    let midDiff = Cartesian3.subtract(corner, midPointPrev, new Cartesian3());
    midDiff = Cartesian3.multiplyByScalar(midDiff, midScale, new Cartesian3());
    const positionFromMid = Cartesian3.add(midPoint, midDiff, new Cartesian3());

    const distancePrev = Cartesian3.distance(corner, oppositePoint);
    const distanceCurrent = Cartesian3.distance(positionFromMid, oppositePoint);
    const distanceScale = distanceCurrent / distancePrev;
    let distanceDiff = Cartesian3.subtract(
      corner,
      oppositePoint,
      new Cartesian3(),
    );

    distanceDiff = Cartesian3.multiplyByScalar(
      distanceDiff,
      distanceScale,
      new Cartesian3(),
    );
    let newCornerPosition = Cartesian3.add(
      oppositePoint,
      distanceDiff,
      new Cartesian3(),
    );
    if (negate) {
      distanceDiff = Cartesian3.negate(distanceDiff, new Cartesian3());
      newCornerPosition = Cartesian3.add(
        oppositePoint,
        distanceDiff,
        new Cartesian3(),
      );
    }
    return newCornerPosition;
  }

  rotateRectangle(startPosition: Cartesian3, endPosition: Cartesian3): void {
    const positions = [...this.activePoints_];
    const center = Cartesian3.midpoint(
      positions[0],
      positions[2],
      new Cartesian3(),
    );
    const centerCart = Cartographic.fromCartesian(center);
    const endCart = Cartographic.fromCartesian(endPosition);
    const startCart = Cartographic.fromCartesian(startPosition);
    const angleStart =
      Math.PI +
      Math.atan2(
        endCart.longitude - centerCart.longitude,
        endCart.latitude - centerCart.latitude,
      );
    const angleEnd =
      Math.PI +
      Math.atan2(
        startCart.longitude - centerCart.longitude,
        startCart.latitude - centerCart.latitude,
      );
    const angleDiff = angleEnd - angleStart;

    positions.forEach((pos, indx) => {
      const point = Cartographic.fromCartesian(pos);
      const cosTheta = Math.cos(angleDiff);
      const sinTheta = Math.sin(angleDiff);
      const vLon =
        cosTheta * (point.longitude - centerCart.longitude) -
        (sinTheta * (point.latitude - centerCart.latitude)) /
          Math.abs(Math.cos(centerCart.latitude));
      const vLat =
        sinTheta *
          (point.longitude - centerCart.longitude) *
          Math.abs(Math.cos(centerCart.latitude)) +
        cosTheta * (point.latitude - centerCart.latitude);
      const lon = centerCart.longitude + vLon;
      const lat = centerCart.latitude + vLat;

      positions[indx] = Cartographic.toCartesian(new Cartographic(lon, lat));
    });
    this.sketchPoints_.forEach((sp, key) => {
      sp.position = new ConstantPositionProperty(positions[key]);
      this.activePoints_[key] = positions[key];
    });
    this.viewer_.scene.requestRender();
  }

  onMouseMove_(event: ScreenSpaceEventHandler.MotionEvent): void {
    this.renderSceneIfTranslucent();
    if (!event?.endPosition) return;
    const pickedPosition = this.viewer_.scene.pickPosition(event.endPosition);
    if (!pickedPosition) return;
    const position = Cartesian3.clone(pickedPosition);
    if (this.entityForEdit && !!this.leftPressedPixel_) {
      if (this.moveEntity) {
        if (this.type === 'point') {
          const cartographicPosition = Cartographic.fromCartesian(
            this.entityForEdit.position.getValue(this.julianDate),
          );
          this.activePoints_[0] = position;
          updateHeightForCartesianPositions(
            this.activePoints_,
            cartographicPosition.height,
            undefined,
            true,
          );
        } else {
          const pointProperties = this.sketchPoint_.properties;
          const index: number = <number>pointProperties.index;
          let prevPosition = new Cartesian3();
          if (typeof index === 'number') {
            this.sketchPoint_.position = new ConstantPositionProperty(position);
            prevPosition = Cartesian3.clone(this.activePoints_[index]);
            this.activePoints_[index] = position;
          }
          if (this.type === 'polygon') {
            // move virtual SPs
            const idx = <number>this.sketchPoint_.properties.index;
            const spLen = this.sketchPoints_.length;
            const prevRealSPIndex = ((spLen + idx - 1) * 2) % spLen;
            const prevRealSP = this.sketchPoints_[prevRealSPIndex];
            const prevVirtualPosition = this.halfwayPosition_(
              prevRealSP,
              this.sketchPoint_,
            );
            this.sketchPoints_[prevRealSPIndex + 1].position =
              new ConstantPositionProperty(prevVirtualPosition);

            const nextRealSPIndex = ((spLen + idx + 1) * 2) % spLen;
            const nextRealSP = this.sketchPoints_[nextRealSPIndex];
            const nextVirtualPosition = this.halfwayPosition_(
              nextRealSP,
              this.sketchPoint_,
            );
            this.sketchPoints_[idx * 2 + 1].position =
              new ConstantPositionProperty(nextVirtualPosition);
          }
          if (this.type === 'line') {
            // move virtual SPs
            const idx = <number>this.sketchPoint_.properties.index;
            if (idx > 0) {
              const prevRealSP = this.sketchPoints_[(idx - 1) * 2];
              const prevVirtualPosition = this.halfwayPosition_(
                prevRealSP,
                this.sketchPoint_,
              );
              this.sketchPoints_[(idx - 1) * 2 + 1].position =
                new ConstantPositionProperty(prevVirtualPosition);
            }
            if (idx < this.activePoints_.length - 1) {
              const nextRealSP = this.sketchPoints_[(idx + 1) * 2];
              const nextVirtualPosition = this.halfwayPosition_(
                nextRealSP,
                this.sketchPoint_,
              );
              this.sketchPoints_[(idx + 1) * 2 - 1].position =
                new ConstantPositionProperty(nextVirtualPosition);
            }
          } else {
            const positions = this.activePoints_;
            if (this.type === 'rectangle') {
              if (
                pointProperties.type &&
                (<ConstantProperty>pointProperties.type).getValue() === 'rotate'
              ) {
                const oldPosition = this.sketchPoint_.position.getValue(
                  this.julianDate,
                );
                this.rotateRectangle(oldPosition, position);
                return;
              }
              const oppositeIndex = index > 1 ? index - 2 : index + 2;
              const leftIndex = index - 1 < 0 ? 3 : index - 1;
              const rightIndex = index + 1 > 3 ? 0 : index + 1;
              let draggedPoint = positions[index];
              const oppositePoint = positions[oppositeIndex];
              let leftPoint = positions[leftIndex];
              let rightPoint = positions[rightIndex];

              const midPoint = Cartesian3.midpoint(
                draggedPoint,
                oppositePoint,
                new Cartesian3(),
              );
              const midPointPrev = Cartesian3.midpoint(
                prevPosition,
                oppositePoint,
                new Cartesian3(),
              );
              const midDist = Cartesian3.distance(draggedPoint, midPoint);
              const midDistPrev = Cartesian3.distance(
                prevPosition,
                midPointPrev,
              );
              const midScale = midDist / midDistPrev;

              const negate = this.checkForNegateMove(
                draggedPoint,
                oppositePoint,
                leftPoint,
                rightPoint,
              );
              leftPoint = this.updateRectCorner(
                leftPoint,
                oppositePoint,
                midPoint,
                midPointPrev,
                midScale,
                negate.left,
              );
              rightPoint = this.updateRectCorner(
                rightPoint,
                oppositePoint,
                midPoint,
                midPointPrev,
                midScale,
                negate.right,
              );

              draggedPoint = this.getCorrectRectCorner(
                draggedPoint,
                oppositePoint,
                leftPoint,
                rightPoint,
              );
              draggedPoint = this.getCorrectRectCorner(
                draggedPoint,
                oppositePoint,
                rightPoint,
                leftPoint,
              );

              positions[index] = draggedPoint;
              this.activePoints_[index] = draggedPoint;
              positions[leftIndex] = leftPoint;
              positions[rightIndex] = rightPoint;
              this.sketchPoints_.forEach((sp, key) => {
                sp.position = new ConstantPositionProperty(positions[key]);
              });
            }
          }
        }
      }
    } else if (this.sketchPoint_) {
      this.activePoint_ = position;
      this.updateSketchPoint();
    }
    this.viewer_.scene.requestRender();
  }

  onDoubleClick_(): void {
    this.isDoubleClick = true;
    if (this.singleClickTimer) {
      clearTimeout(this.singleClickTimer);
    }
    if (!this.activeDistances_.includes(this.activeDistance_)) {
      this.activeDistances_.push(this.activeDistance_);
    }
    this.activePoints_.pop();
    if (this.activeDistances_.length === this.activePoints_.length) {
      this.activeDistances_.pop();
    }
    this.finishDrawing();
  }

  /**
   * Enables moving of point geometry or one of the sketch points for other geometries if left mouse button pressed on it
   */
  onLeftDown_(event: ScreenSpaceEventHandler.PositionedEvent): void {
    this.leftPressedPixel_ = Cartesian2.clone(event.position);
    if (this.entityForEdit) {
      const objects: any[] = this.viewer_.scene.drillPick(
        event.position,
        5,
        5,
        5,
      );
      if (objects.length) {
        const selectedPoint = <{id: Entity} | undefined>(
          objects.find(
            (obj: {id: Entity}) => !!obj.id.point || !!obj.id.billboard,
          )
        );
        if (!selectedPoint) return;
        const selectedEntity = selectedPoint.id;
        this.sketchPoint_ = selectedEntity;
        const properties = selectedEntity.properties;
        // checks if picked entity is point geometry or one of the sketch points for other geometries
        this.moveEntity =
          selectedEntity.id === this.entityForEdit.id ||
          this.sketchPoints_.some((sp) => sp.id === selectedEntity.id) ||
          (properties &&
            properties.type &&
            (<ConstantProperty>properties.type).getValue() === 'rotate');
        if (this.moveEntity && this.sketchPoint_?.properties.virtual) {
          this.extendOrSplitLineOrPolygonPositions_();
        }
      }
      if (this.moveEntity) {
        this.viewer_.scene.screenSpaceCameraController.enableInputs = false;
        this.dispatchEvent(new CustomEvent('leftdown'));
      }
    }
  }

  halfwayPosition_(
    a: Entity | Cartesian3 | PositionProperty | ConstantPositionProperty,
    b: Entity | Cartesian3 | PositionProperty | ConstantPositionProperty,
  ): Cartesian3 {
    a = a instanceof Entity ? a.position : a;
    b = b instanceof Entity ? b.position : b;
    a =
      a instanceof ConstantPositionProperty || a instanceof PositionProperty
        ? <Cartesian3>a.getValue(this.julianDate)
        : a;
    b =
      b instanceof ConstantPositionProperty || b instanceof PositionProperty
        ? <Cartesian3>b.getValue(this.julianDate)
        : b;
    const position = Cartesian3.add(a, b, new Cartesian3());
    Cartesian3.divideByScalar(position, 2, position);
    return position;
  }

  extendOrSplitLineOrPolygonPositions_(): void {
    // Add new line vertex
    // Create SPs, reuse the pressed virtual SP for first segment
    const pressedVirtualSP = this.sketchPoint_;
    const pressedPosition = Cartesian3.clone(
      pressedVirtualSP.position.getValue(this.julianDate),
    );
    const pressedIdx: number = <number>pressedVirtualSP.properties.index;
    const realSP0 = this.sketchPoints_[pressedIdx * 2];
    const realSP2 =
      this.sketchPoints_[((pressedIdx + 1) * 2) % this.sketchPoints_.length];
    const virtualPosition0 = this.halfwayPosition_(realSP0, pressedPosition);
    const virtualPosition1 = this.halfwayPosition_(pressedPosition, realSP2);
    const realSP1 = this.createSketchPoint_(pressedPosition, {edit: true});
    const virtualSP1 = this.createSketchPoint_(virtualPosition1, {
      edit: true,
      virtual: true,
    });
    const virtualSP0 = pressedVirtualSP; // the pressed SP is reused
    virtualSP0.position = new ConstantPositionProperty(virtualPosition0); // but its position is changed

    this.insertVertexToPolylineOrPolygon_(
      pressedIdx + 1,
      pressedPosition.clone(),
    );
    this.sketchPoints_.splice((pressedIdx + 1) * 2, 0, realSP1, virtualSP1);
    this.sketchPoints_.forEach(
      (sp, idx) => (sp.properties.index = Math.floor(idx / 2)),
    );
    this.sketchPoint_ = realSP1;
    this.viewer_.scene.requestRender();
  }

  insertVertexToPolylineOrPolygon_(idx: number, coordinates: Cartesian3): void {
    this.activePoints_.splice(idx, 0, coordinates);
  }

  onLeftUp_(event: ScreenSpaceEventHandler.PositionedEvent): void {
    this.viewer_.scene.screenSpaceCameraController.enableInputs = true;
    const wasAClick = Cartesian2.equalsEpsilon(
      event.position,
      this.leftPressedPixel_,
      0,
      2,
    );
    if (wasAClick) {
      this.onLeftDownThenUp_(event);
    }
    if (this.moveEntity) this.dispatchEvent(new CustomEvent('leftup'));
    this.moveEntity = false;
    this.leftPressedPixel_ = undefined;
    this.sketchPoint_ = undefined;
  }

  onLeftDownThenUp_(_event: ScreenSpaceEventHandler.PositionedEvent): void {
    const e = this.entityForEdit;
    if (
      this.sketchPoint_ &&
      this.sketchPoint_.properties.index !== undefined &&
      !this.sketchPoint_.properties.virtual
    ) {
      // remove clicked position from the edited geometry
      let divider = 1;
      switch (this.type) {
        case 'polygon': {
          const hierarchy: PolygonHierarchy = <PolygonHierarchy>(
            e.polygon.hierarchy.getValue(this.julianDate)
          );
          if (hierarchy.positions.length <= 3) {
            return;
          }
          this.activePoints_.splice(
            <number>this.sketchPoint_.properties.index,
            1,
          );
          divider = 2;
          break;
        }
        case 'line': {
          const pPositions: Cartesian3[] = <Cartesian3[]>(
            e.polyline.positions.getValue(this.julianDate)
          );
          if (pPositions.length <= 2) {
            return;
          }
          this.activePoints_.splice(
            <number>this.sketchPoint_.properties.index,
            1,
          );
          divider = 2;
          break;
        }
        default:
          break;
      }
      // a real sketch point was clicked => remove it
      if (divider === 2) {
        const pressedIdx = <number>this.sketchPoint_.properties.index;
        const pressedIdx2 = pressedIdx * 2;
        const isLine = this.type === 'line';
        const firstPointClicked = isLine && pressedIdx === 0;
        const lastPointClicked =
          isLine && pressedIdx2 === this.sketchPoints_.length - 1;

        if (!firstPointClicked && !lastPointClicked) {
          // Move previous virtual SP in the middle of preRealSP and nextRealSP
          const prevRealSPIndex2 =
            (this.sketchPoints_.length + pressedIdx2 - 2) %
            this.sketchPoints_.length;
          const nextRealSPIndex2 =
            (pressedIdx2 + 2) % this.sketchPoints_.length;
          const prevRealSP = this.sketchPoints_[prevRealSPIndex2];
          const prevVirtualSP = this.sketchPoints_[prevRealSPIndex2 + 1];
          const nextRealSP = this.sketchPoints_[nextRealSPIndex2];
          const newPosition = this.halfwayPosition_(prevRealSP, nextRealSP);
          prevVirtualSP.position = new ConstantPositionProperty(newPosition);
        }

        let removedSPs;
        if (lastPointClicked) {
          // remove 2 SPs backward
          removedSPs = this.sketchPoints_.splice(pressedIdx2 - 1, 2);
        } else {
          // remove 2 SP forward
          removedSPs = this.sketchPoints_.splice(pressedIdx2, 2);
        }
        this.sketchPoints_.forEach(
          (s, index) => (s.properties.index = Math.floor(index / divider)),
        );
        removedSPs.forEach((s) => this.drawingDataSource.entities.remove(s));
      } else if (this.type === 'polygon' || this.type === 'line') {
        this.sketchPoints_.splice(
          <number>this.sketchPoint_.properties.index,
          1,
        );
        this.sketchPoints_.forEach((sp, idx) => (sp.properties.index = idx));
        this.drawingDataSource.entities.remove(this.sketchPoint_);
      }
      this.viewer_.scene.requestRender();
    }
  }

  getCorrectRectCorner(
    corner: Cartesian3,
    oppositePoint: Cartesian3,
    checkPoint1: Cartesian3,
    checkPoint2: Cartesian3,
  ): Cartesian3 {
    const distance = Cartesian3.distance(checkPoint1, oppositePoint);
    const newDistance = Cartesian3.distance(corner, checkPoint2);
    const dScale = distance / newDistance;
    let dDiff = Cartesian3.subtract(corner, checkPoint2, new Cartesian3());
    dDiff = Cartesian3.multiplyByScalar(dDiff, dScale, new Cartesian3());
    return Cartesian3.add(checkPoint2, dDiff, new Cartesian3());
  }

  checkForNegateMove(
    draggedPoint: Cartesian3,
    oppositePoint: Cartesian3,
    leftPoint: Cartesian3,
    rightPoint: Cartesian3,
  ): {right: boolean; left: boolean} {
    const draggedPoint2D =
      this.viewer_.scene.cartesianToCanvasCoordinates(draggedPoint);
    const rightPoint2D =
      this.viewer_.scene.cartesianToCanvasCoordinates(rightPoint);
    const leftPoint2D =
      this.viewer_.scene.cartesianToCanvasCoordinates(leftPoint);
    const oppositePoint2D =
      this.viewer_.scene.cartesianToCanvasCoordinates(oppositePoint);
    if (!draggedPoint2D || !rightPoint2D || !leftPoint2D || !oppositePoint2D) {
      return {
        right: false,
        left: false,
      };
    }
    return {
      right: !!Intersections2D.computeLineSegmentLineSegmentIntersection(
        draggedPoint2D.x,
        draggedPoint2D.y,
        rightPoint2D.x,
        rightPoint2D.y,
        leftPoint2D.x,
        leftPoint2D.y,
        oppositePoint2D.x,
        oppositePoint2D.y,
      ),
      left: !!Intersections2D.computeLineSegmentLineSegmentIntersection(
        draggedPoint2D.x,
        draggedPoint2D.y,
        leftPoint2D.x,
        leftPoint2D.y,
        rightPoint2D.x,
        rightPoint2D.y,
        oppositePoint2D.x,
        oppositePoint2D.y,
      ),
    };
  }

  getSegmentsInfo(distances: number[]): SegmentInfo[] {
    const positions = [...this.activePoints_];
    positions.push(this.activePoint_);
    return distances.map((dist, indx) => {
      let easting: number = 0;
      let northing: number = 0;
      let height: number = 0;
      const position =
        indx === distances.length - 1 && this.type === 'polygon'
          ? positions[0]
          : positions[indx + 1];
      if (position && positions[indx]) {
        const cartPosition1 = Cartographic.fromCartesian(positions[indx]);
        const cartPosition2 = Cartographic.fromCartesian(position);
        const geodesic = new EllipsoidGeodesic(cartPosition1, cartPosition2);
        northing = Math.abs(
          geodesic.surfaceDistance * Math.cos(geodesic.startHeading),
        );
        easting = Math.abs(
          geodesic.surfaceDistance * Math.sin(geodesic.startHeading),
        );
        height = Math.abs(cartPosition2.height - cartPosition1.height);
      }
      return {
        length: dist,
        eastingDiff: easting,
        northingDiff: northing,
        heightDiff: height,
      };
    });
  }
}

function getDimensionLabelText(options: {
  type: GeometryTypes;
  distances?: number[];
  positions?: Cartesian3[];
}) {
  const distances = options.distances;
  const type = options.type;
  let text = '';
  if (type === 'rectangle' && distances?.length) {
    text = `${Number(distances[0]).toFixed(1)}m x ${Number(distances[1]).toFixed(1)}m`;
  } else if (type === 'polygon') {
    text = `${options.positions?.length ? Number(getPolygonArea(options.positions)).toFixed(1) : 0}m²`;
  } else if (distances?.length) {
    const length = distances.reduce((a, b) => a + b, 0);
    text = `${length.toFixed(1)}m`;
  }
  return text?.includes('undefined') ? '' : text;
}

export function getDimensionLabel(options: {
  type: GeometryTypes;
  distances?: number[];
  positions?: Cartesian3[];
}): LabelGraphics.ConstructorOptions {
  return {
    text: getDimensionLabelText(options),
    font: '8pt arial',
    style: LabelStyle.FILL,
    showBackground: true,
    heightReference: HeightReference.NONE,
    verticalOrigin: VerticalOrigin.BOTTOM,
    horizontalOrigin: HorizontalOrigin.RIGHT,
    pixelOffset: new Cartesian2(-5, -5),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  };
}

const scratchAB = new Cartesian3();
const scratchAC = new Cartesian3();
const scratchAM = new Cartesian3();
const scratchAP = new Cartesian3();
const scratchBP = new Cartesian3();

function rectanglify(coordinates: Cartesian3[]) {
  if (coordinates.length === 3) {
    // A and B are the base of the triangle, C is the point currently moving:
    //
    // A -- AP
    // |\
    // | \
    // |  \
    // |   \
    // M    C
    // |
    // B -- BP

    const A = coordinates[0];
    const B = coordinates[1];
    const C = coordinates[2];

    // create the two vectors from the triangle coordinates
    const AB = Cartesian3.subtract(B, A, scratchAB);
    const AC = Cartesian3.subtract(C, A, scratchAC);

    const AM = Cartesian3.projectVector(AC, AB, scratchAM);

    const AP = Cartesian3.subtract(C, AM, scratchAP).clone();
    const BP = Cartesian3.add(AP, AB, scratchBP).clone();

    return [A, B, BP, AP];
  } else {
    return coordinates;
  }
}

function triangulate(positions: Cartesian2[], holes: number[]): number[] {
  const flattenedPositions: number[] = Cartesian2.packArray(positions);

  return earcut(flattenedPositions, holes, 2);
}

function getPolygonArea(positions: Cartesian3[], holes: number[] = []): number {
  const indices = triangulate(positions, holes);
  let area = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const vector1 = positions[indices[i]];
    const vector2 = positions[indices[i + 1]];
    const vector3 = positions[indices[i + 2]];
    //triangle sides
    const a = Cartesian3.distance(vector3, vector2);
    const b = Cartesian3.distance(vector1, vector3);
    const c = Cartesian3.distance(vector1, vector2);
    const p = (a + b + c) / 2;
    const triangleArea = Math.sqrt((p - a) * (p - b) * (p - c) * p);

    area += triangleArea;
  }
  return area;
}

export type Measurements = {
  positions: Cartesian3[];
  type: GeometryTypes;
  numberOfSegments: number;
  segmentsLength: number[];
  perimeter?: number;
  area?: number;
};

/**
 * Returns measurements for geometry
 */
function getMeasurements(
  positions: Cartesian3[],
  type: GeometryTypes,
): Measurements {
  const segmentsLength: number[] = [];
  positions.forEach((p, key) => {
    if (key > 0) {
      segmentsLength.push(Cartesian3.distance(positions[key - 1], p));
    }
  });
  const result: Measurements = {
    numberOfSegments: positions.length - 1,
    segmentsLength: segmentsLength.map((l) => Number(l.toFixed(3))),
    positions,
    type,
  };
  let perimeter = segmentsLength.reduce((a, b) => a + b, 0);
  if (type === 'rectangle') {
    perimeter *= 2;
  }
  result.perimeter = perimeter;
  if (type === 'rectangle' || (type === 'polygon' && positions.length > 2)) {
    result.area = getPolygonArea(positions);
  }
  return result;
}
