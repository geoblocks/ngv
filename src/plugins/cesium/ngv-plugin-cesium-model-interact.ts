import {html, LitElement, nothing} from 'lit';
import type {HTMLTemplateResult, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {
  CesiumWidget,
  PrimitiveCollection,
  Cesium3DTileset,
  Event,
  DataSourceCollection,
  Cartesian2} from '@cesium/engine';
import {HeadingPitchRoll, Transforms, Ellipsoid as CesiumEllipsoid} from '@cesium/engine';
import {Cartographic, Math as CMath} from '@cesium/engine';
import {
  Model,
  Cartesian3,
  Matrix4,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Quaternion,
  TranslationRotationScale,
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
import {
  applyClippingTo3dTileset,
  getModelFootprintPositions,
  removeClippingFrom3dTilesets,
  updateModelClipping,
} from './interactionHelpers.js';
import type {ControlType} from './controlsHelpers.js';
import type {DragState} from './controlsDragMath.js';
import {applyDrag, startDrag} from './controlsDragMath.js';
import type {INGVCesiumModel} from '../../interfaces/cesium/ingv-layers.js';
import type {PositionChangeDetail} from '../ui/ngv-layer-details.js';
import {Task} from '@lit/task';
import {ControlAxis} from './controlAxis.js';
import type {ControlPickId} from './controlAxis.js';

@customElement('ngv-plugin-cesium-model-interact')
export class NgvPluginCesiumModelInteract extends LitElement {
  @property({type: Object}) viewer: CesiumWidget;
  @property({type: Object}) primitiveCollection: PrimitiveCollection;
  @property({type: Object}) tiles3dCollection: PrimitiveCollection;
  @property({type: Object}) dataSourceCollection: DataSourceCollection;
  @property({type: Object}) storeOptions?: {localStoreKey: string; indexDbName: string};
  @property({type: Object}) options?: {listTitle: string; showEditBtns?: boolean};

  @state() private chosenModel: INGVCesiumModel | undefined;
  @state() private savedMatrix: Matrix4 | undefined;
  @state() private modelPosition: {
    longitude: number; latitude: number; height: number;
    heading: number; pitch: number; roll: number; scale: number;
  } | undefined;
  @state() private models: INGVCesiumModel[] = [];
  @state() private controlMode: ControlType = 'translate';

  private clickHandler: ScreenSpaceEventHandler | undefined;
  private dragState: DragState | undefined;
  private unlistenPreRender: Event.RemoveCallback | undefined;
  private control: ControlAxis | undefined;
  private dragging = false;

  private _onWinPointerDown  = (e: PointerEvent) => this._handlePointerDown(e);
  private _onWinPointerMove  = (e: PointerEvent) => this._handlePointerMove(e);
  private _onWinPointerUp    = (e: PointerEvent) => this._handlePointerUp(e);
  private _onCanvasPointerMove = (e: PointerEvent) => this._handleHover(e);

  protected readonly _chosenModelChange = new Task(this, {
    args: (): [INGVCesiumModel | undefined] => [this.chosenModel],
    task: ([m]) => { this.dispatchEvent(new CustomEvent('chosenModelChanged', {detail: m})); },
  });

  private setControlMode(m: ControlType): void {
    this.controlMode = m;
    if (this.control) this.control.mode = m;
  }

  private pickControl(clientX: number, clientY: number): ControlPickId | undefined {
    if (!this.control || !this.chosenModel) return undefined;
    return this.control.hitTest(clientX, clientY);
  }

  pickModel(canvasPos: Cartesian2): INGVCesiumModel | undefined {
    const obj = this.viewer.scene.pick(canvasPos) as {primitive?: Model} | undefined;
    return obj?.primitive instanceof Model && this.primitiveCollection.contains(obj.primitive)
      ? (obj.primitive as INGVCesiumModel) : undefined;
  }

  private _handleHover(e: PointerEvent): void {
    if (this.dragging || !this.control || !this.chosenModel) return;
    const controlPickId = this.pickControl(e.clientX, e.clientY);
    this.control.highlight(controlPickId?.controlAxis);
    this.viewer.canvas.style.cursor = controlPickId ? 'grab' : 'default';
  }

  private _handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0 || !this.chosenModel) return;
    // Only care if the pointer is inside the canvas
    const rect = this.viewer.scene.canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom) return;

    const controlPickId = this.pickControl(e.clientX, e.clientY);
    if (!controlPickId) return;

    e.stopImmediatePropagation();
    e.preventDefault();

    const state = startDrag(controlPickId.controlType, controlPickId.controlAxis, this.chosenModel,
                            this.viewer.scene, e.clientX, e.clientY);
    if (!state) return;

    this.dragState = state;
    this.dragging = true;
    this.viewer.scene.screenSpaceCameraController.enableInputs = false;

    if (this.chosenModel.id.tilesClipping || this.chosenModel.id.terrainClipping) {
      removeClippingFrom3dTilesets(this.chosenModel, this.tiles3dCollection, this.viewer.scene.globe);
    }

    try { this.viewer.canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }

    window.addEventListener('pointermove', this._onWinPointerMove, {capture: true});
    window.addEventListener('pointerup',   this._onWinPointerUp,   {capture: true});
    this.viewer.canvas.style.cursor = 'grabbing';
  }

  private _handlePointerMove(e: PointerEvent): void {
    if (!this.dragging || !this.dragState || !this.chosenModel) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    applyDrag(this.dragState, this.chosenModel, this.viewer.scene, e.clientX, e.clientY);
    this.viewer.scene.requestRender();
  }

  private _handlePointerUp(e: PointerEvent): void {
    if (!this.dragging) return;
    e.stopImmediatePropagation();

    window.removeEventListener('pointermove', this._onWinPointerMove, {capture: true});
    window.removeEventListener('pointerup',   this._onWinPointerUp,   {capture: true});
    try { this.viewer.canvas.releasePointerCapture(e.pointerId); } catch { /* ok */ }

    this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    this.dragging = false;
    // Always reset highlight so axes don't stay lit after drag ends
    this.control?.highlight(undefined);

    if (this.dragState && this.chosenModel) {
      if (this.chosenModel.id.tilesClipping || this.chosenModel.id.terrainClipping) {
        updateModelClipping(this.chosenModel, this.tiles3dCollection, this.viewer.scene.globe);
      }
      this.modelPosition = this.extractModelPosition(this.chosenModel);
      if (this.storeOptions) updateModelsInLocalStore(this.storeOptions.localStoreKey, this.models);
    }
    this.dragState = undefined;
    this.viewer.canvas.style.cursor = 'default';
  }

  initEvents(): void {
    this.clickHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.clickHandler.setInputAction(
      (evt: ScreenSpaceEventHandler.PositionedEvent) => this.onClick(evt),
      ScreenSpaceEventType.LEFT_CLICK,
    );

    this.viewer.canvas.addEventListener('pointermove', this._onCanvasPointerMove);

    window.addEventListener('pointerdown', this._onWinPointerDown, {capture: true});

    this.primitiveCollection.primitiveAdded.addEventListener((model: INGVCesiumModel) => {
      this.onPrimitivesChanged();
      updateModelClipping(model, this.tiles3dCollection, this.viewer.scene.globe);
    });
    this.primitiveCollection.primitiveRemoved.addEventListener((p: INGVCesiumModel) => {
      if (this.storeOptions) {
        deleteFromIndexedDB(this.storeOptions.indexDbName, p.id.name)
          .then(() => this.onPrimitivesChanged())
          .catch((err) => console.error(err));
      } else {
        this.onPrimitivesChanged();
      }
    });
    this.tiles3dCollection?.primitiveAdded.addEventListener((tileset: Cesium3DTileset) => {
      applyClippingTo3dTileset(tileset, this.models);
    });

    if (this.dataSourceCollection) {
      this.control = new ControlAxis(this.viewer.scene, this.dataSourceCollection);
      this.control.mode = this.controlMode;
    }
  }

  removeEvents(): void {
    if (this.clickHandler) { this.clickHandler.destroy(); this.clickHandler = undefined; }
    if (this.unlistenPreRender) { this.unlistenPreRender(); this.unlistenPreRender = undefined; }
    this._stopContinuousRender();
    this.viewer?.canvas.removeEventListener('pointermove', this._onCanvasPointerMove);
    window.removeEventListener('pointerdown', this._onWinPointerDown, {capture: true});
    window.removeEventListener('pointermove', this._onWinPointerMove, {capture: true});
    window.removeEventListener('pointerup',   this._onWinPointerUp,   {capture: true});
    if (this.control && this.dataSourceCollection) {
      this.control.destroy(this.dataSourceCollection);
      this.control = undefined;
    }
  }

  onPrimitivesChanged(): void {
    this.models = [];
    for (let i = 0; i < this.primitiveCollection.length; i++) {
      const m = this.primitiveCollection.get(i) as INGVCesiumModel;
      if (m instanceof Model) this.models.push(m);
    }
    if (this.storeOptions) updateModelsInLocalStore(this.storeOptions.localStoreKey, this.models);
  }

  extractModelPosition(model: INGVCesiumModel): typeof this.modelPosition {
    const pos = Matrix4.getTranslation(model.modelMatrix, new Cartesian3());
    const carto = Cartographic.fromCartesian(pos);
    const hpr = Transforms.fixedFrameToHeadingPitchRoll(
      model.modelMatrix, CesiumEllipsoid.WGS84,
      Transforms.localFrameToFixedFrameGenerator('north', 'west'),
    );

    const scaleVec = Matrix4.getScale(model.modelMatrix, new Cartesian3());
    const enuFrame = Transforms.eastNorthUpToFixedFrame(pos, CesiumEllipsoid.WGS84, new Matrix4());
    const enuColMag = Math.sqrt(enuFrame[0]**2 + enuFrame[1]**2 + enuFrame[2]**2);
    const scale = enuColMag > 0 ? scaleVec.x / enuColMag : 1;
    return {
      longitude: CMath.toDegrees(carto.longitude),
      latitude:  CMath.toDegrees(carto.latitude),
      height:    carto.height,
      heading:   CMath.toDegrees(hpr.heading),
      pitch:     CMath.toDegrees(hpr.pitch),
      roll:      CMath.toDegrees(hpr.roll),
      scale:     Math.round(scale * 1000) / 1000,
    };
  }

  onClick(evt: ScreenSpaceEventHandler.PositionedEvent): void {
    if (this.dragging) return;
    const rect  = this.viewer.scene.canvas.getBoundingClientRect();
    const sx    = rect.width  / this.viewer.scene.canvas.width;
    const sy    = rect.height / this.viewer.scene.canvas.height;
    const clientX = rect.left + evt.position.x * sx;
    const clientY = rect.top  + evt.position.y * sy;
    if (this.pickControl(clientX, clientY)) return;

    const model = this.pickModel(evt.position);
    if (model) {
      if (model !== this.chosenModel) {
        this.selectModel(model);
      }
    } else {
      this.deselectModel();
    }
  }

  private selectModel(model: INGVCesiumModel): void {
    this.chosenModel = model;
    this.savedMatrix = Matrix4.clone(model.modelMatrix, new Matrix4());
    this.modelPosition = this.extractModelPosition(model);
    this.control?.show(model);
    this._startContinuousRender();
  }

  private deselectModel(): void {
    this.chosenModel = undefined;
    this.savedMatrix = undefined;
    this.modelPosition = undefined;
    this.control?.hide();
    this._stopContinuousRender();
  }

  private _unlistenPostRender: Event.RemoveCallback | undefined;
  private _startContinuousRender(): void {
    if (this._unlistenPostRender) return;
    this._unlistenPostRender = this.viewer.scene.postRender.addEventListener(() => {
      this.viewer.scene.requestRender();
    });
    this.viewer.scene.requestRender();
  }
  private _stopContinuousRender(): void {
    if (this._unlistenPostRender) {
      this._unlistenPostRender();
      this._unlistenPostRender = undefined;
    }
  }

  async initModelsAndEvents(): Promise<void> {
    const storedModels = this.storeOptions ? getStoredModels(this.storeOptions.localStoreKey) : undefined;
    if (storedModels?.length) {
      await Promise.all(storedModels.map(async (m: StoredModel) => {
        const blob = await getBlobFromIndexedDB(this.storeOptions.indexDbName, m.name);
        const model: INGVCesiumModel = await instantiateModel({
          type: 'model',
          options: {
            url: URL.createObjectURL(blob),
            scene: this.viewer.scene,
            modelMatrix: Matrix4.fromTranslationRotationScale(new TranslationRotationScale(
              new Cartesian3(...m.translation),
              new Quaternion(...m.rotation),
              new Cartesian3(...m.scale),
            )),
            id: {
              name: m.name,
              terrainClipping: m.terrainClipping,
              tilesClipping: m.tilesClipping,
              dimensions: m.dimensions?.length === 3
                ? new Cartesian3(m.dimensions[0], m.dimensions[1], m.dimensions[2])
                : undefined,
              localCenter: m.localCenter?.length === 3
                ? new Cartesian3(m.localCenter[0], m.localCenter[1], m.localCenter[2])
                : undefined,
            },
          },
        }, undefined, (readyModel) =>
          updateModelClipping(readyModel, this.tiles3dCollection, this.viewer.scene.globe),
        );
        this.primitiveCollection.add(model);
      }));
      this.onPrimitivesChanged();
      this.initEvents();
      this.viewer.scene.requestRender();
    } else {
      this.initEvents();
    }
  }

  firstUpdated(_changedProperties: PropertyValues): void {
    this.initModelsAndEvents().catch((e) => console.error(e));
    super.firstUpdated(_changedProperties);
  }

  protected shouldUpdate(): boolean {
    return !!this.viewer && !!this.primitiveCollection;
  }

  render(): HTMLTemplateResult | typeof nothing {
    if (!this.chosenModel && !this.models?.length) return nothing;
    return html`${this.chosenModel ? html`
      <ngv-layer-details
        .layer="${{
          name: this.chosenModel.id.name,
          position: this.modelPosition,
        }}"
        .showDone=${true}
        .showCancel=${true}
        @positionChange=${(evt: {detail: PositionChangeDetail}) => {
          if (!this.chosenModel || !this.modelPosition) return;
          const updated = {...this.modelPosition, ...evt.detail};
          this.modelPosition = updated;
          const cartesian = Cartographic.toCartesian(
            Cartographic.fromDegrees(updated.longitude, updated.latitude, updated.height),
          );
          const newHpr = new HeadingPitchRoll(
            CMath.toRadians(updated.heading),
            CMath.toRadians(updated.pitch),
            CMath.toRadians(updated.roll),
          );
          const newMatrix = Transforms.headingPitchRollToFixedFrame(
            cartesian, newHpr, CesiumEllipsoid.WGS84,
            Transforms.localFrameToFixedFrameGenerator('north', 'west'),
          );
          const enuColMag = Math.sqrt(newMatrix[0]**2 + newMatrix[1]**2 + newMatrix[2]**2);
          const s = Math.max(0.001, updated.scale) * enuColMag;
          Matrix4.setScale(newMatrix, new Cartesian3(s, s, s), newMatrix);
          Matrix4.clone(newMatrix, this.chosenModel.modelMatrix);
          if (this.chosenModel.id.tilesClipping || this.chosenModel.id.terrainClipping) {
            updateModelClipping(this.chosenModel, this.tiles3dCollection, this.viewer.scene.globe);
          }
          this.viewer.scene.requestRender();
        }}
        @done="${() => {
          this.deselectModel();
          this.onPrimitivesChanged();
        }}"
        @cancel="${() => {
          if (this.chosenModel && this.savedMatrix) {
            Matrix4.clone(this.savedMatrix, this.chosenModel.modelMatrix);
            if (this.chosenModel.id.tilesClipping || this.chosenModel.id.terrainClipping) {
              updateModelClipping(this.chosenModel, this.tiles3dCollection, this.viewer.scene.globe);
            }
            this.viewer.scene.requestRender();
          }
          this.deselectModel();
          this.onPrimitivesChanged();
        }}"
      >
        <div slot="actions-start" style="display:flex;gap:4px;padding:4px 0;">
          <wa-button size="small"
            appearance="${this.controlMode === 'translate' ? 'filled' : 'outlined'}"
            title="Move" @click="${() => this.setControlMode('translate')}"
          ><wa-icon name="arrows-up-down-left-right"></wa-icon></wa-button>
          <wa-button size="small"
            appearance="${this.controlMode === 'rotate' ? 'filled' : 'outlined'}"
            title="Rotate" @click="${() => this.setControlMode('rotate')}"
          ><wa-icon name="rotate"></wa-icon></wa-button>
          <wa-button size="small"
            appearance="${this.controlMode === 'scale' ? 'filled' : 'outlined'}"
            title="Scale" @click="${() => this.setControlMode('scale')}"
          ><wa-icon name="up-right-and-down-left-from-center"></wa-icon></wa-button>
        </div>
      </ngv-layer-details>`
    : html`<wa-card with-header>
        <div slot="header">
          <wa-icon src="../../../icons/cube.svg"></wa-icon>
          ${this.options?.listTitle}
        </div>
        <ngv-layers-list
          .options="${{showDeleteBtns: true, showZoomBtns: true, showEditBtns: this.options?.showEditBtns, showAddClippingBtns: this.options?.showEditBtns}}"
          .layers=${this.models.map((m) => ({name: m.id.name}))}
          @addClipping="${(evt: {detail: number}) => {
            const model = this.primitiveCollection.get(evt.detail) as INGVCesiumModel;
            if (!model) return;
            const positions = getModelFootprintPositions(model);
            this.dispatchEvent(new CustomEvent('modelAddClipping', {
              detail: {positions, name: model.id.name},
              bubbles: true, composed: true,
            }));
          }}"
          @edit="${(evt: {detail: number}) => {
            const model = this.primitiveCollection.get(evt.detail) as INGVCesiumModel;
            if (model) this.selectModel(model);
          }}"
          @remove="${(evt: {detail: number}) => {
            const model = this.primitiveCollection.get(evt.detail) as INGVCesiumModel;
            if (model) this.primitiveCollection.remove(model);
          }}"
          @zoom="${(evt: {detail: number}) => {
            const model = this.primitiveCollection.get(evt.detail) as INGVCesiumModel;
            this.viewer.camera.flyToBoundingSphere(model.boundingSphere, {duration: 2});
          }}"
        ></ngv-layers-list>
      </wa-card>`}`;
  }

  createRenderRoot(): this { return this; }

  disconnectedCallback(): void {
    this.removeEvents();
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-model-interact': NgvPluginCesiumModelInteract;
  }
}
