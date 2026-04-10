import {
  Cartesian3,
  Matrix3,
  Matrix4,
} from '@cesium/engine';

export type ControlsAxis = 'x' | 'y' | 'z' | 'all';
export type ControlType = 'translate' | 'rotate' | 'scale';

export function getModelAxes(modelMatrix: Matrix4): Record<'x' | 'y' | 'z', Cartesian3> {
  const rot = Matrix4.getRotation(modelMatrix, new Matrix3());
  return {
    x: Cartesian3.normalize(new Cartesian3(rot[0], rot[1], rot[2]), new Cartesian3()),
    y: Cartesian3.normalize(new Cartesian3(rot[3], rot[4], rot[5]), new Cartesian3()),
    z: Cartesian3.normalize(new Cartesian3(rot[6], rot[7], rot[8]), new Cartesian3()),
  };
}
