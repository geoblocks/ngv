import type {Cartesian2, Scene} from '@cesium/engine';
import {
  Cartesian3,
  IntersectionTests,
  Matrix3,
  Matrix4,
  Plane,
  Quaternion,
  Ray,
} from '@cesium/engine';
import type {INGVCesiumModel} from '../../interfaces/cesium/ingv-layers.js';
import type {ControlsAxis, ControlType} from './controlsHelpers.js';
import {getModelAxes} from './controlsHelpers.js';

export interface DragState {
  type: ControlType;
  axis: ControlsAxis;
  startMatrix: Matrix4;
  startScale: Cartesian3;
  prevMouseX: number;
  prevMouseY: number;
  initialMouseX: number;
  initialMouseY: number;
  dragPlane?: Plane;
  dragOrigin?: Cartesian3;
  rotAxis?: Cartesian3;
  rotTangentX?: number;
  rotTangentY?: number;
  accumulatedAngle?: number;
}

const scratchRay = new Ray();
const scratchIntersect = new Cartesian3();

function measureScale(modelMatrix: Matrix4): Cartesian3 {
  return Matrix4.getScale(modelMatrix, new Cartesian3());
}

function applyScale(startMatrix: Matrix4, totalFactor: number, result: Matrix4): void {
  const baseScale = Matrix4.getScale(startMatrix, new Cartesian3()).x;
  const newScale  = Math.max(0.001, baseScale * totalFactor);
  Matrix4.clone(startMatrix, result);
  Matrix4.setScale(result, new Cartesian3(newScale, newScale, newScale), result);
}

function screenPlane(center: Cartesian3, scene: Scene): Plane {
  const n = Cartesian3.normalize(
    Cartesian3.subtract(scene.camera.position, center, new Cartesian3()),
    new Cartesian3(),
  );
  return Plane.fromPointNormal(center, n);
}

function axisPlane(center: Cartesian3, axisDir: Cartesian3, scene: Scene): Plane {
  const camDir = Cartesian3.normalize(
    Cartesian3.subtract(center, scene.camera.position, new Cartesian3()),
    new Cartesian3(),
  );
  const c1 = Cartesian3.cross(axisDir, camDir, new Cartesian3());
  let n = Cartesian3.cross(c1, axisDir, new Cartesian3());
  if (Cartesian3.magnitude(n) < 1e-6) {
    n = Cartesian3.normalize(Cartesian3.clone(center), new Cartesian3());
  } else {
    Cartesian3.normalize(n, n);
  }
  return Plane.fromPointNormal(center, n);
}

function worldToPage(pt: Cartesian3, scene: Scene): {x: number; y: number} | undefined {
  const canvas = scene.cartesianToCanvasCoordinates(pt);
  if (!canvas) return undefined;
  const rect   = scene.canvas.getBoundingClientRect();
  return {
    x: rect.left + canvas.x * (rect.width  / scene.canvas.width),
    y: rect.top  + canvas.y * (rect.height / scene.canvas.height),
  };
}

export function startDrag(
  type: ControlType,
  axis: ControlsAxis,
  model: INGVCesiumModel,
  scene: Scene,
  mouseX: number,
  mouseY: number,
): DragState | undefined {
  const rect = scene.canvas.getBoundingClientRect();
  const canvasPos = {
    x: (mouseX - rect.left) * (scene.canvas.width  / rect.width),
    y: (mouseY - rect.top)  * (scene.canvas.height / rect.height),
  } as Cartesian2;

  const translation = Matrix4.getTranslation(model.modelMatrix, new Cartesian3());
  const axes        = getModelAxes(model.modelMatrix);
  const startMatrix = Matrix4.clone(model.modelMatrix, new Matrix4());
  const startScale  = measureScale(startMatrix);

  if (type === 'translate') {
    const plane = axis === 'all'
      ? screenPlane(translation, scene)
      : axisPlane(translation, axes[axis], scene);
    const ray = scene.camera.getPickRay(canvasPos, scratchRay);
    if (!ray) return undefined;
    const hit = IntersectionTests.rayPlane(ray, plane, scratchIntersect);
    if (!hit) return undefined;
    return {
      type, axis, startMatrix, startScale,
      prevMouseX: mouseX, prevMouseY: mouseY,
      initialMouseX: mouseX, initialMouseY: mouseY,
      dragPlane: plane,
      dragOrigin: Cartesian3.clone(hit, new Cartesian3()),
    };
  }

  if (type === 'rotate') {
    const rotAxis = axis === 'all'
      ? Cartesian3.normalize(Cartesian3.subtract(scene.camera.position, translation, new Cartesian3()), new Cartesian3())
      : Cartesian3.clone(axes[axis], new Cartesian3());

    const screenCtr = worldToPage(translation, scene);
    let tangentX = 0;
    let tangentY = 1;
    if (screenCtr) {
      const fromCtrX = mouseX - screenCtr.x;
      const fromCtrY = mouseY - screenCtr.y;
      const len = Math.sqrt(fromCtrX * fromCtrX + fromCtrY * fromCtrY);
      if (len > 1) {
        tangentX = -fromCtrY / len;
        tangentY =  fromCtrX / len;
      }
    }

    const camToModel = Cartesian3.normalize(
      Cartesian3.subtract(translation, scene.camera.position, new Cartesian3()),
      new Cartesian3(),
    );
    const sign = Cartesian3.dot(rotAxis, camToModel) > 0 ? -1 : 1;

    return {
      type, axis, startMatrix, startScale,
      prevMouseX: mouseX, prevMouseY: mouseY,
      initialMouseX: mouseX, initialMouseY: mouseY,
      rotAxis,
      rotTangentX: tangentX * sign,
      rotTangentY: tangentY * sign,
      accumulatedAngle: 0,
    };
  }

  return {
    type, axis, startMatrix, startScale,
    prevMouseX: mouseX, prevMouseY: mouseY,
    initialMouseX: mouseX, initialMouseY: mouseY,
  };
}

export function applyDrag(
  state: DragState,
  model: INGVCesiumModel,
  scene: Scene,
  mouseX: number,
  mouseY: number,
): void {
  const rect = scene.canvas.getBoundingClientRect();
  const dmx  = mouseX - state.prevMouseX;
  const dmy  = mouseY - state.prevMouseY;
  state.prevMouseX = mouseX;
  state.prevMouseY = mouseY;

  if (state.type === 'translate') {
    const canvasPos = {
      x: (mouseX - rect.left) * (scene.canvas.width  / rect.width),
      y: (mouseY - rect.top)  * (scene.canvas.height / rect.height),
    } as Cartesian2;
    const ray = scene.camera.getPickRay(canvasPos, scratchRay);
    if (!ray || !state.dragPlane || !state.dragOrigin) return;
    const hit = IntersectionTests.rayPlane(ray, state.dragPlane, scratchIntersect);
    if (!hit) return;
    const delta = Cartesian3.subtract(hit, state.dragOrigin, new Cartesian3());
    let moveVec: Cartesian3;
    if (state.axis === 'all') {
      moveVec = delta;
    } else {
      const axisDir = getModelAxes(state.startMatrix)[state.axis];
      moveVec = Cartesian3.multiplyByScalar(axisDir, Cartesian3.dot(delta, axisDir), new Cartesian3());
    }
    const startT = Matrix4.getTranslation(state.startMatrix, new Cartesian3());
    Matrix4.clone(state.startMatrix, model.modelMatrix);
    Matrix4.setTranslation(
      model.modelMatrix,
      Cartesian3.add(startT, moveVec, new Cartesian3()),
      model.modelMatrix,
    );
    return;
  }

  if (state.type === 'rotate') {
    if (!state.rotAxis || state.rotTangentX === undefined ||
        state.rotTangentY === undefined || state.accumulatedAngle === undefined) return;
    const pixelDelta = dmx * state.rotTangentX + dmy * state.rotTangentY;
    const angleDelta = (pixelDelta / 250) * Math.PI * 2;
    state.accumulatedAngle += angleDelta;

    const startT = Matrix4.getTranslation(state.startMatrix, new Cartesian3());
    const rot    = Quaternion.fromAxisAngle(state.rotAxis, state.accumulatedAngle, new Quaternion());
    const rotM4  = Matrix4.fromRotationTranslation(
      Matrix3.fromQuaternion(rot, new Matrix3()), Cartesian3.ZERO, new Matrix4(),
    );
    const toO   = Matrix4.fromTranslation(Cartesian3.negate(startT, new Cartesian3()), new Matrix4());
    const fromO = Matrix4.fromTranslation(startT, new Matrix4());
    Matrix4.multiply(
      fromO,
      Matrix4.multiply(rotM4, Matrix4.multiply(toO, state.startMatrix, new Matrix4()), new Matrix4()),
      model.modelMatrix,
    );
    return;
  }

  if (state.type === 'scale') {
    const totalDx = mouseX - state.initialMouseX;
    const logFactor = totalDx / 200;
    const totalFactor = Math.pow(2, logFactor);
    applyScale(state.startMatrix, totalFactor, model.modelMatrix);
  }
}
