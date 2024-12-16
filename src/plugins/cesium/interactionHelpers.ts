import {
  Cesium3DTileset,
  ClippingPolygonCollection,
  CustomDataSource, Globe,
  Model,
  PrimitiveCollection,
  Scene
} from '@cesium/engine';
import {
  ArcType,
  Axis,
  BoundingSphere,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  ClippingPolygon,
  Color,
  Ellipsoid,
  HeadingPitchRoll,
  IntersectionTests,
  Matrix3,
  Matrix4,
  Plane,
  Quaternion,
  Ray,
  TranslationRotationScale,
} from '@cesium/engine';
import type {INGVCesiumModel} from '../../interfaces/cesium/ingv-layers.js';

export type PlaneColorOptions = {
  material?: Color;
  outline?: boolean;
  outlineColor?: Color;
};

export type EdgeStyleOptions = {
  width?: number;
  material?: Color;
};

export type CornerPointStyleOptions = {
  radiusPx?: number;
  material?: Color;
};

export type BBoxStyles = {
  planeColorOptions?: PlaneColorOptions;
  edgeStyleOptions?: EdgeStyleOptions;
  cornerPointStyleOptions: CornerPointStyleOptions;
};

const DefaultPlaneColorOptions: PlaneColorOptions = {
  material: Color.RED.withAlpha(0.1),
  outline: true,
  outlineColor: Color.WHITE,
};

const DefaultEdgeStyles: EdgeStyleOptions = {
  width: 10,
  material: Color.WHITE.withAlpha(0.3),
};

const DefaultCornerPointStyles: CornerPointStyleOptions = {
  radiusPx: 10,
  material: Color.BROWN,
};

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
  const verticalEdge: [Cartesian3, Cartesian3] = [downPoint, upPoint];
  // const topEdge: [Cartesian3, Cartesian3] = [nextUpPoint, upPoint];
  // const bottomEdge: [Cartesian3, Cartesian3] = [nextDownPoint, downPoint];
  LOCAL_EDGES.push(verticalEdge);
});

const scaleScratch = new Cartesian3();
export function getScaleFromMatrix(matrix: Matrix4): Cartesian3 {
  return Matrix4.getScale(matrix, scaleScratch);
}

const dimensionsScratch = new Cartesian3();
function getScaledDimensions(model: INGVCesiumModel): Cartesian3 {
  Cartesian3.clone(model.id.dimensions, dimensionsScratch);
  Cartesian3.multiplyComponents(
    getScaleFromMatrix(model.modelMatrix),
    dimensionsScratch,
    dimensionsScratch,
  );
  return dimensionsScratch;
}

const scratchRotationMatrix = new Matrix3();
const scratchRotationQuaternion = new Quaternion();
export function getRotationQuaternionFromMatrix(matrix: Matrix4): Quaternion {
  return Quaternion.fromRotationMatrix(
    Matrix4.getRotation(matrix, scratchRotationMatrix),
    scratchRotationQuaternion,
  );
}

const scratchTranslation = new Cartesian3();
export function getTranslationFromMatrix(matrix: Matrix4): Cartesian3 {
  return Matrix4.getTranslation(matrix, scratchTranslation);
}

const scratchTranslationRotationDimensionsMatrix = new Matrix4();
export function getTranslationRotationDimensionsMatrix(
  model: INGVCesiumModel,
  result = scratchTranslationRotationDimensionsMatrix,
): Matrix4 {
  return Matrix4.fromTranslationRotationScale(
    new TranslationRotationScale(
      getTranslationFromMatrix(model.modelMatrix),
      getRotationQuaternionFromMatrix(model.modelMatrix),
      getScaledDimensions(model),
    ),
    result,
  );
}

const scratchTranslationRotationScaleMatrix = new Matrix4();
export function getTranslationRotationScaleMatrix(
  matrix: Matrix4,
  result = scratchTranslationRotationScaleMatrix,
): Matrix4 {
  return Matrix4.fromTranslationRotationScale(
    new TranslationRotationScale(
      getTranslationFromMatrix(matrix),
      getRotationQuaternionFromMatrix(matrix),
      getScaleFromMatrix(matrix),
    ),
    result,
  );
}

const centerDiffScratch = new Cartesian3();
export function getModelCenterDiff(model: Model): Cartesian3 {
  return Cartesian3.subtract(
    model.boundingSphere.center,
    getTranslationFromMatrix(model.modelMatrix),
    centerDiffScratch,
  );
}

const scaleMatrixScratch = new Matrix4();
const planeScaleScratch = new Cartesian3();
function getPlaneScale(model: INGVCesiumModel) {
  const dimensions = getScaledDimensions(model);
  Cartesian3.fromArray(
    [dimensions.x, dimensions.y, dimensions.z],
    0,
    planeScaleScratch,
  );

  return Matrix4.fromScale(planeScaleScratch, scaleMatrixScratch);
}

const planeDimensionsScratch = new Cartesian2();
function getPlaneDimensions(model: INGVCesiumModel, normalAxis: Axis) {
  const dimensions = getScaledDimensions(model);
  let dimensionsArray: number[] = [];

  if (normalAxis === Axis.X) {
    dimensionsArray = [dimensions.y, dimensions.z];
  } else if (normalAxis === Axis.Y) {
    dimensionsArray = [dimensions.x, dimensions.z];
  } else if (normalAxis === Axis.Z) {
    dimensionsArray = [dimensions.x, dimensions.y];
  }

  return Cartesian2.fromArray(dimensionsArray, 0, planeDimensionsScratch);
}

export function createPlaneEntity(
  dataSource: CustomDataSource,
  plane: Plane,
  model: INGVCesiumModel,
  colorOptions: PlaneColorOptions = DefaultPlaneColorOptions,
): void {
  const normalAxis: Axis = plane.normal.x
    ? Axis.X
    : plane.normal.y
      ? Axis.Y
      : Axis.Z;

  dataSource.entities.add({
    position: new CallbackProperty(() => model.boundingSphere.center, false),
    orientation: new CallbackProperty(
      () => getRotationQuaternionFromMatrix(model.modelMatrix),
      false,
    ),
    plane: {
      plane: new CallbackProperty(
        () => Plane.transform(plane, getPlaneScale(model)),
        false,
      ),
      dimensions: new CallbackProperty(
        () => getPlaneDimensions(model, normalAxis),
        false,
      ),
      ...colorOptions,
    },
  });
}
export function createEdge(
  dataSource: CustomDataSource,
  model: INGVCesiumModel,
  edge: Cartesian3[],
  styles: EdgeStyleOptions = DefaultEdgeStyles,
): void {
  const positions = [new Cartesian3(), new Cartesian3()];
  dataSource.entities.add({
    polyline: {
      show: true,
      positions: new CallbackProperty(() => {
        const matrix = getTranslationRotationDimensionsMatrix(model);
        Matrix4.multiplyByPoint(matrix, edge[0], positions[0]);
        Matrix4.multiplyByPoint(matrix, edge[1], positions[1]);
        const centerDiff = getModelCenterDiff(model);
        Cartesian3.add(positions[0], centerDiff, positions[0]);
        Cartesian3.add(positions[1], centerDiff, positions[1]);
        return positions;
      }, false),
      width: styles.width,
      material: styles.material,
      arcType: ArcType.NONE,
    },
  });
}

export function createCornerPoint(
  dataSource: CustomDataSource,
  model: INGVCesiumModel,
  edges: Cartesian3[],
  scene: Scene,
  styles: CornerPointStyleOptions = DefaultCornerPointStyles,
): void {
  const position = new Cartesian3();
  const boundingSphere = new BoundingSphere();
  edges.forEach((localEdge) => {
    dataSource.entities.add({
      position: new CallbackProperty(() => {
        const matrix = getTranslationRotationDimensionsMatrix(model);
        Matrix4.multiplyByPoint(matrix, localEdge, position);
        const centerDiff = getModelCenterDiff(model);
        Cartesian3.add(position, centerDiff, position);
        boundingSphere.center = position;
        return position;
      }, false),
      ellipsoid: {
        show: true,
        radii: new CallbackProperty(() => {
          const pixelSize = getPixelSize(scene, boundingSphere);
          const worldRadius = pixelSize * styles.radiusPx;
          return new Cartesian3(worldRadius, worldRadius, worldRadius);
        }, false),
        material: styles.material,
      },
    });
  });
}

export function showModelBBox(
  dataSources: {
    topDownPlanesDataSource?: CustomDataSource;
    sidePlanesDataSource?: CustomDataSource;
    edgeLinesDataSource?: CustomDataSource;
    cornerPointsDataSource?: CustomDataSource;
  },
  model: INGVCesiumModel,
  scene: Scene,
  styles: BBoxStyles = {
    planeColorOptions: DefaultPlaneColorOptions,
    edgeStyleOptions: DefaultEdgeStyles,
    cornerPointStyleOptions: DefaultCornerPointStyles,
  },
): void {
  const topDownPlanesDataSource = dataSources.topDownPlanesDataSource;
  const sidePlanesDataSource = dataSources.sidePlanesDataSource;
  if (topDownPlanesDataSource || sidePlanesDataSource) {
    SIDE_PLANES.forEach((plane) => {
      const normalAxis: Axis = plane.normal.x
        ? Axis.X
        : plane.normal.y
          ? Axis.Y
          : Axis.Z;

      const dataSource =
        normalAxis === Axis.Z ? topDownPlanesDataSource : sidePlanesDataSource;
      if (dataSource)
        createPlaneEntity(dataSource, plane, model, styles.planeColorOptions);
    });
  }
  if (dataSources.edgeLinesDataSource) {
    LOCAL_EDGES.forEach((edge) =>
      createEdge(
        dataSources.edgeLinesDataSource,
        model,
        edge,
        styles.edgeStyleOptions,
      ),
    );
  }
  if (dataSources.cornerPointsDataSource) {
    LOCAL_EDGES.forEach((edge) =>
      createCornerPoint(
        dataSources.cornerPointsDataSource,
        model,
        edge,
        scene,
        styles.cornerPointStyleOptions,
      ),
    );
  }
}

const scratchQuaternionRotate = new Quaternion();
const scratchMatrix3Rotate = new Matrix3();
const scratchHpr = new HeadingPitchRoll();
export function rotate(
  startPosition: Cartesian2,
  endPosition: Cartesian2,
  matrixToRotate: Matrix4,
): void {
  const dx = endPosition.x - startPosition.x;
  const sensitivity = 0.5;
  const heading = -dx * sensitivity;
  HeadingPitchRoll.fromDegrees(heading, 0, 0, scratchHpr);

  Matrix3.fromQuaternion(
    Quaternion.fromHeadingPitchRoll(scratchHpr, scratchQuaternionRotate),
    scratchMatrix3Rotate,
  );

  Matrix4.multiplyByMatrix3(
    matrixToRotate,
    scratchMatrix3Rotate,
    matrixToRotate,
  );
}

const scratchScale = new Cartesian3();
const scratchScaleMatrix = new Matrix4();
// todo use axis to have correct scale direction
export function scale(
  startPosition: Cartesian2,
  endPosition: Cartesian2,
  matrix: Matrix4,
): void {
  const dx = endPosition.x - startPosition.x;
  const sensitivity = 0.01;
  const scaleAmount = 1 + dx * sensitivity;

  Matrix4.fromScale(
    Cartesian3.fromArray(
      [scaleAmount, scaleAmount, scaleAmount],
      0,
      scratchScale,
    ),
    scratchScaleMatrix,
  );
  Matrix4.multiply(matrix, scratchScaleMatrix, matrix);
}

const scratchPickedPositionCart = new Cartographic();
const scratchPickedPosition = new Cartesian3();
const scratchUpDirection = new Cartesian3();
const scratchTop2d = new Cartesian2();
const scratchBottom2d = new Cartesian2();
const scratchAxis2D = new Cartesian2();
const scratchMouseMoveVector = new Cartesian2();
export function getVerticalMoveVector(
  scene: Scene,
  pickedPosition: Cartesian3,
  endPosition: Cartesian2,
  model: INGVCesiumModel,
  result: Cartesian3 = new Cartesian3(),
): Cartesian3 {
  const cartPickedPosition = Cartographic.fromCartesian(
    pickedPosition,
    Ellipsoid.default,
    scratchPickedPositionCart,
  );
  pickedPosition.clone(scratchPickedPosition);
  const bottomPos = Cartesian3.fromRadians(
    cartPickedPosition.longitude,
    cartPickedPosition.latitude,
    cartPickedPosition.height - model.id.dimensions.y,
  );
  scene.cartesianToCanvasCoordinates(scratchPickedPosition, scratchTop2d);
  scene.cartesianToCanvasCoordinates(bottomPos, scratchBottom2d);
  Cartesian2.subtract(scratchTop2d, scratchBottom2d, scratchAxis2D);
  Cartesian2.subtract(endPosition, scratchTop2d, scratchMouseMoveVector);
  const scalar2d =
    Cartesian2.dot(scratchMouseMoveVector, scratchAxis2D) /
    Cartesian2.dot(scratchAxis2D, scratchAxis2D);

  const scalar3d =
    getPixelSize(scene, model.boundingSphere) *
    scalar2d *
    model.id.dimensions.y;

  Cartesian3.normalize(
    getTranslationFromMatrix(model.modelMatrix),
    scratchUpDirection,
  );
  return Cartesian3.multiplyByScalar(scratchUpDirection, scalar3d, result);
}

const scratchCameraRay = new Ray();
const scratchRayPlane = new Cartesian3();
export function getHorizontalMoveVector(
  scene: Scene,
  pickedPosition: Cartesian3,
  endPosition: Cartesian2,
  movePlane: Plane,
  result: Cartesian3 = new Cartesian3(),
): Cartesian3 | undefined {
  const cameraRay = scene.camera.getPickRay(endPosition, scratchCameraRay);
  if (!cameraRay) {
    return undefined;
  }
  const nextPosition = IntersectionTests.rayPlane(
    cameraRay,
    movePlane,
    scratchRayPlane,
  );

  if (!nextPosition) {
    return undefined;
  }

  return Cartesian3.subtract(nextPosition, pickedPosition, result);
}

export function getPixelSize(
  scene: Scene,
  boundingSphere: BoundingSphere,
): number {
  return scene.camera.getPixelSize(
    boundingSphere,
    scene.drawingBufferWidth,
    scene.drawingBufferHeight,
  );
}

type GltfJson = {
  bufferViews: {byteOffset: number; byteLength: number}[];
  accessors: Record<number, {min: number[]; max: number[]}>;
  meshes: {
    primitives: {
      attributes: {
        POSITION: number;
      };
    }[];
  }[];
};

export function getDimensions(model: Model): Cartesian3 {
  // @ts-expect-error loader is not part of API
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
  const json: GltfJson = model.loader.gltfJson;

  const diameter = model.boundingSphere.radius * 2;
  const min = new Cartesian3(diameter, diameter, diameter);
  const max = new Cartesian3(
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
  );

  json.meshes.forEach(function (mesh) {
    mesh.primitives.forEach(function (primitive) {
      const positionAccessor = json.accessors[primitive.attributes.POSITION];

      if (positionAccessor) {
        if (positionAccessor.min) {
          min.x = Math.min(min.x, positionAccessor.min[1]);
          min.y = Math.min(min.y, positionAccessor.min[0]);
          min.z = Math.min(min.z, positionAccessor.min[2]);
        }
        if (positionAccessor.max) {
          max.x = Math.max(max.x, positionAccessor.max[1]);
          max.y = Math.max(max.y, positionAccessor.max[0]);
          max.z = Math.max(max.z, positionAccessor.max[2]);
        }
      }
    });
  });

  return Cartesian3.subtract(max, min, new Cartesian3());
}

export function getClippingPolygon(model: INGVCesiumModel): ClippingPolygon {
  const positions = LOCAL_EDGES.map((edge) => {
    const position = new Cartesian3();
    const matrix = getTranslationRotationDimensionsMatrix(model);
    Matrix4.multiplyByPoint(matrix, edge[0], position);
    const centerDiff = getModelCenterDiff(model);
    Cartesian3.add(position, centerDiff, position);
    return position;
  });
  return new ClippingPolygon({
    positions,
  });
}

export function applyClippingTo3dTileset(tileset: Cesium3DTileset, models: INGVCesiumModel[]): void {
  const polygons: ClippingPolygon[] = [];
  models.forEach((m) => {
    if (m.id.tilesClipping) {
      polygons.push(getClippingPolygon(m));
    }
  });
  tileset.clippingPolygons = new ClippingPolygonCollection({
    polygons,
  });
}

export function updateModelClipping(model: INGVCesiumModel, tiles3dCollection: PrimitiveCollection, globe: Globe): void {
  if ((!tiles3dCollection?.length && !globe) || !model?.ready) return;
  const polygon = model.id.clippingPolygon;
  const newPolygon = getClippingPolygon(model);

  // apply to 3d tiles
  if (tiles3dCollection?.length) {
    for (let i = 0; i < tiles3dCollection.length; i++) {
      const tileset: Cesium3DTileset = tiles3dCollection.get(
        i,
      ) as Cesium3DTileset;
      if (polygon && tileset.clippingPolygons?.contains(polygon)) {
        tileset.clippingPolygons.remove(polygon);
      }
      if (model.id.tilesClipping) {
        if (!tileset.clippingPolygons) {
          tileset.clippingPolygons = new ClippingPolygonCollection({
            polygons: [newPolygon],
          });
        } else {
          tileset.clippingPolygons.add(newPolygon);
        }
      }
    }
  }

  // apply to terrain
  if (globe) {
    if (polygon && globe?.clippingPolygons?.contains(polygon)) {
      globe.clippingPolygons.remove(polygon);
    }
    if (model.id.terrainClipping) {
      if (!globe.clippingPolygons) {
        globe.clippingPolygons = new ClippingPolygonCollection({
          polygons: [newPolygon],
        });
      } else {
        globe.clippingPolygons.add(newPolygon);
      }
    }
  }

  model.id.clippingPolygon = newPolygon;
}

export function removeClippingFrom3dTilesets(model: INGVCesiumModel, tiles3dCollection: PrimitiveCollection, globe: Globe): void {
  if ((!tiles3dCollection?.length && !globe) || !model.ready) return;
  const polygon = model.id.clippingPolygon;
  if (tiles3dCollection?.length) {
    for (let i = 0; i < tiles3dCollection.length; i++) {
      const tileset: Cesium3DTileset = tiles3dCollection.get(
        i,
      ) as Cesium3DTileset;
      if (tileset.clippingPolygons?.contains(polygon)) {
        tileset.clippingPolygons.remove(polygon);
      }
    }
  }

  if (globe?.clippingPolygons?.contains(polygon)) {
    globe.clippingPolygons.remove(polygon);
  }
}
