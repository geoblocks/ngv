import type {
  Cesium3DTileset,
  DirectionUp,
  Globe,
  Model,
  PrimitiveCollection,
  Scene,
  Cartesian2} from '@cesium/engine';
import {Math as CMath} from '@cesium/engine';
import {ClippingPolygonCollection} from '@cesium/engine';
import {
  Cartesian3,
  Cartographic,
  ClippingPolygon,
  Ellipsoid,
  HeadingPitchRoll,
  Matrix3,
  Matrix4,
  Quaternion,
  TranslationRotationScale,
} from '@cesium/engine';
import type {INGVCesiumModel} from '../../interfaces/cesium/ingv-layers.js';

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
  LOCAL_EDGES.push(verticalEdge);
});

const dimensionsScratch = new Cartesian3();
function getScaledDimensions(model: INGVCesiumModel): Cartesian3 {
  return Cartesian3.clone(model.id.dimensions, dimensionsScratch);
}

const scratchTranslationRotationDimensionsMatrix = new Matrix4();
const scratchLocalBBoxMatrix = new Matrix4();
export function getTranslationRotationDimensionsMatrix(
  model: INGVCesiumModel,
  result = scratchTranslationRotationDimensionsMatrix,
): Matrix4 {
  const localCenter = model.id.localCenter ?? Cartesian3.ZERO;
  const dimensions = getScaledDimensions(model);
  Matrix4.fromTranslationRotationScale(
    new TranslationRotationScale(localCenter, Quaternion.IDENTITY, dimensions),
    scratchLocalBBoxMatrix,
  );
  return Matrix4.multiply(model.modelMatrix, scratchLocalBBoxMatrix, result);
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

/** Recursively search obj for a property named key, up to maxDepth levels deep */
function deepFind(obj: unknown, key: string, maxDepth: number): unknown {
  if (!obj || typeof obj !== 'object' || maxDepth <= 0) return undefined;
  const rec = obj as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(rec, key)) return rec[key];
  for (const k of Object.keys(rec)) {
    if (k.startsWith('_')) {
      const found = deepFind(rec[k], key, maxDepth - 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function getDimensions(model: Model): {
  dimensions: Cartesian3;
  localCenter: Cartesian3;
} {
  try {
    // @ts-expect-error sceneGraph is not part of API
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sceneGraph = model.sceneGraph;
    // @ts-expect-error loader is not part of API
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const loader = model.loader;

    // Try multiple known private paths for different Cesium versions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    const json: GltfJson = loader?._gltfJson
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ?? loader?._loader?._gltfJson
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ?? loader?._gltfLoader?._gltfJson
      ?? deepFind(loader as unknown, '_gltfJson', 4);

    if (!json) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console.warn('[getDimensions] json not found. loader keys:', Object.keys(loader ?? {}));
    }

    const axisCorrectionMatrix: Matrix4 =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (sceneGraph?._axisCorrectionMatrix as Matrix4 | undefined) ?? Matrix4.IDENTITY;
    const componentsTransform: Matrix4 =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (sceneGraph?._components?.transform as Matrix4 | undefined) ?? Matrix4.IDENTITY;

    const internalCorrection = Matrix4.multiplyTransformation(
      componentsTransform,
      axisCorrectionMatrix,
      new Matrix4(),
    );

    if (!json?.meshes) throw new Error('no mesh data');

    const tMin = new Cartesian3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const tMax = new Cartesian3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    const scratch = new Cartesian3();

    json.meshes.forEach((mesh) => {
      mesh.primitives.forEach((primitive) => {
        const accessor = json.accessors[primitive.attributes.POSITION];
        if (!accessor?.min || !accessor?.max) return;
        const [x0, y0, z0] = accessor.min as [number, number, number];
        const [x1, y1, z1] = accessor.max as [number, number, number];
        for (const [cx, cy, cz] of [
          [x0,y0,z0],[x1,y0,z0],[x0,y1,z0],[x1,y1,z0],
          [x0,y0,z1],[x1,y0,z1],[x0,y1,z1],[x1,y1,z1],
        ] as [number,number,number][]) {
          Matrix4.multiplyByPoint(
            internalCorrection,
            Cartesian3.fromElements(cx, cy, cz, scratch),
            scratch,
          );
          tMin.x = Math.min(tMin.x, scratch.x); tMax.x = Math.max(tMax.x, scratch.x);
          tMin.y = Math.min(tMin.y, scratch.y); tMax.y = Math.max(tMax.y, scratch.y);
          tMin.z = Math.min(tMin.z, scratch.z); tMax.z = Math.max(tMax.z, scratch.z);
        }
      });
    });

    if (isFinite(tMin.x)) {
      return {
        dimensions: Cartesian3.subtract(tMax, tMin, new Cartesian3()),
        localCenter: Cartesian3.midpoint(tMin, tMax, new Cartesian3()),
      };
    }
  } catch (_e) {
    console.warn('[getDimensions] glTF parse failed, using bounding sphere fallback:', _e);
  }

  const r = model.boundingSphere.radius;
  const side = (r / Math.sqrt(3)) * 2;
  try {
    const invMatrix = Matrix4.inverseTransformation(model.modelMatrix, new Matrix4());
    const localCenter = Matrix4.multiplyByPoint(invMatrix, model.boundingSphere.center, new Cartesian3());
    return {
      dimensions: new Cartesian3(side, side, side),
      localCenter,
    };
  } catch {
    return {
      dimensions: new Cartesian3(side, side, side),
      localCenter: new Cartesian3(0, 0, 0),
    };
  }
}

export function getModelFootprintPositions(model: INGVCesiumModel): Cartesian3[] {
  return LOCAL_EDGES.map((edge) => {
    const position = new Cartesian3();
    const matrix = getTranslationRotationDimensionsMatrix(model);
    Matrix4.multiplyByPoint(matrix, edge[0], position);
    return position;
  });
}

export function getClippingPolygon(model: INGVCesiumModel): ClippingPolygon {
  return new ClippingPolygon({
    positions: getModelFootprintPositions(model),
  });
}

export function applyClippingTo3dTileset(
  tileset: Cesium3DTileset,
  models: INGVCesiumModel[],
): void {
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

export function updateModelClipping(
  model: INGVCesiumModel,
  tiles3dCollection: PrimitiveCollection,
  globe: Globe,
): void {
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

export function removeClippingFrom3dTilesets(
  model: INGVCesiumModel,
  tiles3dCollection: PrimitiveCollection,
  globe: Globe,
): void {
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

/**
 * Sets height in meters for each cartesian3 position in array
 */
export function updateHeightForCartesianPositions(
  positions: Cartesian3[],
  height?: number,
  scene?: Scene,
  assignBack: boolean = false,
): Cartesian3[] {
  return positions.map((p) => {
    const cartographicPosition = Cartographic.fromCartesian(p);
    if (typeof height === 'number' && !isNaN(height))
      cartographicPosition.height = height;
    if (scene) {
      const altitude = scene.globe.getHeight(cartographicPosition) || 0;
      cartographicPosition.height += altitude;
    }
    return assignBack
      ? Cartographic.toCartesian(cartographicPosition, Ellipsoid.WGS84, p)
      : Cartographic.toCartesian(cartographicPosition);
  });
}

export function calculateViewOnRectangle(
  bottomLeft: Cartesian3,
  bottomRight: Cartesian3,
  topLeft: Cartesian3,
  topRight: Cartesian3,
  fovAngle: number,
): {
  destination: Cartesian3;
  orientation: DirectionUp;
} {
  // Calculate the midpoint of the rectangle
  const midpoint = Cartesian3.multiplyByScalar(
    Cartesian3.add(
      Cartesian3.add(bottomLeft, bottomRight, new Cartesian3()),
      Cartesian3.add(topLeft, topRight, new Cartesian3()),
      new Cartesian3(),
    ),
    0.25,
    new Cartesian3(),
  );

  const verticalDistance = Cartesian3.distance(topLeft, bottomLeft);
  const horizontalDistance = Cartesian3.distance(bottomLeft, bottomRight);
  const diagonalDistance = Math.sqrt(
    verticalDistance ** 2 + horizontalDistance ** 2,
  );

  const fov = CMath.toRadians(fovAngle);
  const cameraDistance = diagonalDistance / (2 * Math.tan(fov / 2));

  // Calculate the normal vector of the rectangle plane
  const horizontalVector = Cartesian3.subtract(
    bottomRight,
    bottomLeft,
    new Cartesian3(),
  );
  const verticalVector = Cartesian3.subtract(
    topLeft,
    bottomLeft,
    new Cartesian3(),
  );

  const normalVector = Cartesian3.normalize(
    Cartesian3.cross(horizontalVector, verticalVector, new Cartesian3()),
    new Cartesian3(),
  );

  // Camera position is offset along the normal vector
  const cameraPosition = Cartesian3.add(
    midpoint,
    Cartesian3.multiplyByScalar(normalVector, cameraDistance, new Cartesian3()),
    new Cartesian3(),
  );

  const cameraDirection = Cartesian3.negate(normalVector, new Cartesian3());

  return {
    destination: cameraPosition,
    orientation: {
      direction: cameraDirection,
      up: verticalVector,
    },
  };
}
