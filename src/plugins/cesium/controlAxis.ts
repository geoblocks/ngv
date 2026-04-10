import {
  Cartesian2,
  Cartesian3,
  Color,
  Matrix3,
  Matrix4,
  Math as CMath,
  CustomDataSource,
} from '@cesium/engine';
import type {Scene, DataSourceCollection} from '@cesium/engine';
import type {ControlsAxis, ControlType} from './controlsHelpers.js';
import type {INGVCesiumModel} from '../../interfaces/cesium/ingv-layers.js';

export interface ControlPickId {
  controlType: ControlType;
  controlAxis: ControlsAxis;
}

const COLORS: Record<ControlsAxis, Color> = {
  x:   Color.fromCssColorString('#e05252'),
  y:   Color.fromCssColorString('#52c752'),
  z:   Color.fromCssColorString('#5282e0'),
  all: Color.fromCssColorString('#f0a020'),
};
const COLORS_HIGHLIGHT: Record<ControlsAxis, Color> = {
  x:   Color.fromCssColorString('#ff9999'),
  y:   Color.fromCssColorString('#99ff99'),
  z:   Color.fromCssColorString('#99aaff'),
  all: Color.fromCssColorString('#ffd080'),
};

function colorToCss(c: Color): string {
  return `rgba(${Math.round(c.red*255)},${Math.round(c.green*255)},${Math.round(c.blue*255)},${c.alpha})`;
}


function armLength(scene: Scene, center: Cartesian3): number {
  const d = Math.max(1, Cartesian3.distance(scene.camera.position, center));
  const h = Math.max(1, scene.canvas.clientHeight);
  // Target ~65 screen pixels; 1.155 ≈ 2*tan(30°) for a typical 60° vertical FOV
  return (d * 1.155 * 65) / h;
}


function getAxes(modelMatrix: Matrix4): {x: Cartesian3; y: Cartesian3; z: Cartesian3; origin: Cartesian3} {
  const origin = Matrix4.getTranslation(modelMatrix, new Cartesian3());
  const rot    = Matrix4.getRotation(modelMatrix, new Matrix3());
  return {
    origin,
    x: Cartesian3.normalize(new Cartesian3(rot[0], rot[1], rot[2]), new Cartesian3()),
    y: Cartesian3.normalize(new Cartesian3(rot[3], rot[4], rot[5]), new Cartesian3()),
    z: Cartesian3.normalize(new Cartesian3(rot[6], rot[7], rot[8]), new Cartesian3()),
  };
}

function arcPositions(origin: Cartesian3, normal: Cartesian3, radius: number, segments = 64): Cartesian3[] {
  const ref = Math.abs(Cartesian3.dot(normal, Cartesian3.UNIT_Z)) < 0.9
    ? Cartesian3.UNIT_Z : Cartesian3.UNIT_X;
  const u = Cartesian3.normalize(Cartesian3.cross(normal, ref, new Cartesian3()), new Cartesian3());
  const v = Cartesian3.normalize(Cartesian3.cross(normal, u,   new Cartesian3()), new Cartesian3());
  const pts: Cartesian3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * CMath.TWO_PI;
    pts.push(Cartesian3.add(
      origin,
      Cartesian3.add(
        Cartesian3.multiplyByScalar(u, Math.cos(angle) * radius, new Cartesian3()),
        Cartesian3.multiplyByScalar(v, Math.sin(angle) * radius, new Cartesian3()),
        new Cartesian3(),
      ),
      new Cartesian3(),
    ));
  }
  return pts;
}

function toScreen(scene: Scene, world: Cartesian3): {x: number; y: number} | null {
  const c = scene.cartesianToCanvasCoordinates(world, new Cartesian2());
  if (!c) return null;
  const rect = scene.canvas.getBoundingClientRect();
  const sx = scene.canvas.width  / rect.width;
  const sy = scene.canvas.height / rect.height;
  return {x: c.x / sx, y: c.y / sy};
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lenSq));
  return Math.hypot(px - (ax + t*dx), py - (ay + t*dy));
}

function distToPolyline(px: number, py: number, points: string): number {
  const coords = points.trim().split(/\s+/).map(s => s.split(',').map(Number));
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i];
    const [bx, by] = coords[i+1];
    const d = distToSegment(px, py, ax, ay, bx, by);
    if (d < min) min = d;
  }
  return min;
}

export class ControlAxis {
  private _svg: SVGSVGElement;
  private _ds: CustomDataSource;
  private _mode: ControlType = 'translate';
  private _model: INGVCesiumModel | undefined;
  private _scene: Scene;
  private _highlightAxis: ControlsAxis | undefined;
  private _rafId: number | undefined;

  constructor(scene: Scene, dataSourceCollection: DataSourceCollection) {
    this._scene = scene;
    this._ds = new CustomDataSource();
    void dataSourceCollection.add(this._ds);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    for (const [id, col] of Object.entries(COLORS)) {
      const hiCol = COLORS_HIGHLIGHT[id as ControlsAxis];
      defs.innerHTML += `
      <marker id="arr-${id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="${colorToCss(col)}"/>
      </marker>
      <marker id="arr-${id}-hi" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="${colorToCss(hiCol)}"/>
      </marker>
      <marker id="arr-${id}-rev" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
        <path d="M0,0 L6,3 L0,6 Z" fill="${colorToCss(col)}"/>
      </marker>
      <marker id="arr-${id}-hi-rev" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
        <path d="M0,0 L6,3 L0,6 Z" fill="${colorToCss(hiCol)}"/>
      </marker>`;
    }
    svg.appendChild(defs);
    scene.canvas.parentElement?.appendChild(svg);
    this._svg = svg;
  }

  get mode(): ControlType {
    return this._mode;
  }
  set mode(m: ControlType) {
    if (this._mode !== m) {
      this._mode = m;
      this._rebuild();
    }
  }

  show(model: INGVCesiumModel): void {
    this._model = model;
    this._rebuild();
  }

  hide(): void {
    this._model = undefined;
    this._clearAll();
  }

  hitTest(clientX: number, clientY: number): ControlPickId | undefined {
    if (!this._model) return undefined;
    const THRESH = 16; // px – slightly larger for easier interaction
    let best: ControlPickId | undefined;
    let bestDist = THRESH;

    const rect = this._scene.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const getLineCoords = (el: SVGLineElement) => ({
      x1: parseFloat(el.getAttribute('x1') ?? '0'),
      y1: parseFloat(el.getAttribute('y1') ?? '0'),
      x2: parseFloat(el.getAttribute('x2') ?? '0'),
      y2: parseFloat(el.getAttribute('y2') ?? '0'),
    });

    if (this._mode === 'translate') {
      for (const axis of ['x', 'y', 'z'] as const) {
        const line = this._svg.getElementById(`controls-line-${axis}`) as SVGLineElement | null;
        if (!line || line.style.display === 'none') continue;
        const {x1, y1, x2, y2} = getLineCoords(line);
        const d = distToSegment(px, py, x1, y1, x2, y2);
        if (d < bestDist) { bestDist = d; best = {controlType: 'translate', controlAxis: axis}; }
      }
    } else if (this._mode === 'rotate') {
      for (const axis of ['x', 'y', 'z'] as const) {
        const ring = this._svg.getElementById(`controls-ring-${axis}`) as SVGPolylineElement | null;
        if (!ring || ring.style.display === 'none') continue;
        const d = distToPolyline(px, py, ring.getAttribute('points') ?? '');
        if (d < bestDist) { bestDist = d; best = {controlType: 'rotate', controlAxis: axis}; }
      }
    } else if (this._mode === 'scale') {
      const line = this._svg.getElementById('controls-scale-all') as SVGLineElement | null;
      if (line && line.style.display !== 'none') {
        const {x1, y1, x2, y2} = getLineCoords(line);
        const d = distToSegment(px, py, x1, y1, x2, y2);
        if (d < bestDist) { bestDist = d; best = {controlType: 'scale', controlAxis: 'all'}; }
      }
    }
    return best;
  }

  highlight(axis: ControlsAxis | undefined): void {
    if (this._highlightAxis === axis) return;
    this._highlightAxis = axis;
    // Update SVG element colors
    this._svg.querySelectorAll<SVGElement>('[data-axis]').forEach((el) => {
      const elAxis = el.getAttribute('data-axis') as ControlsAxis;
      const isActive = axis !== undefined && elAxis === axis;
      const col = isActive ? COLORS_HIGHLIGHT[elAxis] : COLORS[elAxis];
      const css = colorToCss(col);
      if (el.tagName === 'line' || el.tagName === 'polyline' || el.tagName === 'path') {
        el.setAttribute('stroke', css);
        const markerId  = isActive ? `arr-${elAxis}-hi`     : `arr-${elAxis}`;
        const markerRev = isActive ? `arr-${elAxis}-hi-rev`  : `arr-${elAxis}-rev`;
        if (el.getAttribute('marker-end'))
          el.setAttribute('marker-end', `url(#${markerId})`);
        if (el.getAttribute('marker-start'))
          el.setAttribute('marker-start', `url(#${markerRev})`);
      }
    });
  }

  destroy(dataSourceCollection: DataSourceCollection): void {
    this._clearAll();
    dataSourceCollection.remove(this._ds, true);
    this._svg.remove();
  }

  private _clearAll(): void {
    this._ds.entities.removeAll();
    this._highlightAxis = undefined;
    // Clear SVG lines/rings
    Array.from(this._svg.children).forEach((c) => {
      if (c.tagName !== 'defs') c.remove();
    });
    if (this._rafId !== undefined) {
      cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
    }
  }

  private _rebuild(): void {
    this._clearAll();
    if (!this._model) return;
    if (this._mode === 'translate') this._buildTranslate();
    else if (this._mode === 'rotate') this._buildRotate();
    else this._buildScale();
    this._tick();
  }

  private _svgLine(
    id: string,
    axis: ControlsAxis,
    stroke: string,
    width: number,
    withArrow: boolean,
  ): SVGLineElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('id', id);
    el.setAttribute('data-axis', axis);
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', String(width));
    el.setAttribute('stroke-linecap', 'round');
    if (withArrow) el.setAttribute('marker-end', `url(#arr-${axis})`);
    this._svg.appendChild(el);
    return el;
  }

  private _svgPolyline(
    id: string,
    axis: ControlsAxis,
    stroke: string,
    width: number,
    dashed: boolean,
  ): SVGPolylineElement {
    const el = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'polyline',
    );
    el.setAttribute('id', id);
    el.setAttribute('data-axis', axis);
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', String(width));
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    if (dashed) el.setAttribute('stroke-dasharray', '8 4');
    this._svg.appendChild(el);
    return el;
  }

  private _buildTranslate(): void {
    for (const axis of ['x', 'y', 'z'] as Array<Exclude<ControlsAxis, 'all'>>) {
      this._svgLine(
        `controls-line-${axis}`,
        axis,
        colorToCss(COLORS[axis]),
        3,
        true,
      );
    }
  }

  private _buildRotate(): void {
    for (const axis of ['x', 'y', 'z'] as Array<Exclude<ControlsAxis, 'all'>>) {
      this._svgPolyline(
        `controls-ring-${axis}`,
        axis,
        colorToCss(COLORS[axis]),
        3,
        true,
      );
    }
  }

  private _buildScale(): void {
    // Double-headed SVG line along model X axis; dragging right = scale up
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('id', 'controls-scale-all');
    el.setAttribute('data-axis', 'all');
    el.setAttribute('stroke', colorToCss(COLORS.all));
    el.setAttribute('stroke-width', '4');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('marker-start', 'url(#arr-all-rev)');
    el.setAttribute('marker-end', 'url(#arr-all)');
    this._svg.appendChild(el);
  }

  private _tick(): void {
    if (!this._model) return;
    const model = this._model;
    const scene = this._scene;
    const a = getAxes(model.modelMatrix);
    // Always use the model's actual origin (not bounding sphere center which can be offset/wrong)
    const center = Matrix4.getTranslation(model.modelMatrix, new Cartesian3());
    const arm = armLength(scene, center);
    const sc = toScreen(scene, center);

    if (sc) {
      if (this._mode === 'translate') {
        for (const axis of ['x', 'y', 'z'] as Array<Exclude<ControlsAxis, 'all'>>) {
          const tip = Cartesian3.add(
            center,
            Cartesian3.multiplyByScalar(a[axis], arm, new Cartesian3()),
            new Cartesian3(),
          );
          const st = toScreen(scene, tip);
          const line = this._svg.getElementById(`controls-line-${axis}`) as SVGLineElement | null;
          if (line && st) {
            line.setAttribute('x1', String(sc.x));
            line.setAttribute('y1', String(sc.y));
            line.setAttribute('x2', String(st.x));
            line.setAttribute('y2', String(st.y));
            line.style.display = '';
          } else if (line) line.style.display = 'none';
        }
      } else if (this._mode === 'rotate') {
        // Use three distinct radii (60%, 80%, 100% of arm) for the three rotation axes
        const offsets: Record<string, number> = {x: 0.6, y: 0.8, z: 1.0};
        for (const axis of ['x', 'y', 'z'] as Array<Exclude<ControlsAxis, 'all'>>) {
          const ring = this._svg.getElementById(`controls-ring-${axis}`) as SVGPolylineElement | null;
          if (!ring) continue;
          const rad = arm * offsets[axis];
          const pts3 = arcPositions(center, a[axis], rad, 48);
          const pts2 = pts3
            .map((p) => toScreen(scene, p))
            .filter((p): p is {x: number; y: number} => p !== null);
          if (pts2.length > 2) {
            ring.setAttribute('points', pts2.map((p) => `${p.x},${p.y}`).join(' '));
            ring.style.display = '';
          } else ring.style.display = 'none';
        }
      }
    }

    // Scale arrow is purely screen-space (fixed pixel size), so it is updated
    // independently of the `if (sc)` block above.
    if (this._mode === 'scale') {
      const scLine = this._svg.getElementById('controls-scale-all') as SVGLineElement | null;
      if (scLine) {
        if (sc) {
          const HALF_PX  = 30;  // half-width → 60 px total
          const OFFSET_Y = -24; // above model center, clear of translate arrows
          scLine.setAttribute('x1', String(sc.x - HALF_PX));
          scLine.setAttribute('y1', String(sc.y + OFFSET_Y));
          scLine.setAttribute('x2', String(sc.x + HALF_PX));
          scLine.setAttribute('y2', String(sc.y + OFFSET_Y));
          scLine.style.display = '';
        } else {
          scLine.style.display = 'none';
        }
      }
    }

    this._rafId = requestAnimationFrame(() => this._tick());
  }
}
