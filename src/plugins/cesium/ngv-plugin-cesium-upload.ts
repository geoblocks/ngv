import type {CesiumWidget, PrimitiveCollection} from '@cesium/engine';
import {
  Cartesian3,
  Cartographic,
  HeadingPitchRoll,
  Math as CesiumMath,
  Matrix4,
  Quaternion,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  TranslationRotationScale,
} from '@cesium/engine';
import type {HTMLTemplateResult} from 'lit';
import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import '../ui/ngv-upload.js';
import {instantiateModel} from './ngv-cesium-factories.js';
import type {FileUploadDetails} from '../ui/ngv-upload.js';
import {storeBlobInIndexedDB, updateModelsInLocalStore} from './localStore.js';
import type {INGVCesiumModel} from '../../interfaces/cesium/ingv-layers.js';

const cartographicScratch = new Cartographic();

@customElement('ngv-plugin-cesium-upload')
export class NgvPluginCesiumUpload extends LitElement {
  @property({type: Object})
  public viewer: CesiumWidget;
  @property({type: Object})
  public primitiveCollection: PrimitiveCollection;
  @property({type: Object})
  public storeOptions?: {
    localStoreKey: string;
    indexDbName: string;
  };
  private eventHandler: ScreenSpaceEventHandler | null = null;
  private uploadedModel: INGVCesiumModel | undefined;

  async upload(fileDetails: FileUploadDetails): Promise<void> {
    let url = fileDetails.url;
    let arrayBuffer =
      fileDetails.file && (await fileDetails.file.arrayBuffer());
    if (!arrayBuffer && url) {
      const response = await fetch(url);
      arrayBuffer = await response.arrayBuffer();
    }
    if (!arrayBuffer) {
      return;
    }

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(arrayBuffer.slice(0, 15));
    const isIfc = text.startsWith('ISO-10303-21');

    let blob = new Blob([arrayBuffer]);
    url = URL.createObjectURL(blob);
    if (isIfc) {
      const {ifcToGLTF} = await import('@geoblocks/ifc-gltf');
      try {
        const {glb} = await ifcToGLTF({
          url: url,
          webIfcSettings: {
            wasm: {
              path: '/',
              absolute: true,
            },
          },
        });
        blob = new Blob([glb]);
        url = URL.createObjectURL(blob);
      } catch (e) {
        console.error('Error during file handle or wrong type.', e);
        return;
      }
    }

    const modelMatrix = Matrix4.fromTranslationRotationScale(
      new TranslationRotationScale(
        Cartesian3.ZERO,
        Quaternion.fromHeadingPitchRoll(
          new HeadingPitchRoll(CesiumMath.toRadians(90), 0, 0),
        ),
      ),
    );

    this.uploadedModel = await instantiateModel({
      type: 'model',
      options: {
        url: url,
        scene: this.viewer.scene,
        modelMatrix,
        id: {
          name: fileDetails.name,
          dimensions: Cartesian3.ZERO,
        },
      },
    });
    if (this.storeOptions) {
      await storeBlobInIndexedDB(
        this.storeOptions.indexDbName,
        new Blob([arrayBuffer]),
        fileDetails.name,
      );
    }
    this.primitiveCollection.add(this.uploadedModel);
    this.viewer.scene.requestRender();
    this.showControls();
  }

  showControls(): void {
    this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler.setInputAction(
      (evt: ScreenSpaceEventHandler.MotionEvent) => this.onMouseMove(evt),
      ScreenSpaceEventType.MOUSE_MOVE,
    );
    this.eventHandler.setInputAction(
      this.onClick.bind(this),
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.viewer.canvas.style.cursor = 'move';
  }

  onClick(): void {
    this.viewer.canvas.style.cursor = 'default';
    this.eventHandler.destroy();
    this.eventHandler = null;
    const models: INGVCesiumModel[] = [];
    for (let i = 0; i < this.primitiveCollection.length; i++) {
      models.push(<INGVCesiumModel>this.primitiveCollection.get(i));
    }
    if (this.storeOptions) {
      updateModelsInLocalStore(this.storeOptions.localStoreKey, models);
    }
  }

  onMouseMove(event: ScreenSpaceEventHandler.MotionEvent): void {
    if (!event.endPosition) return;
    const position = this.viewer.scene.pickPosition(event.endPosition);
    if (!position) return;
    const cart = Cartographic.fromCartesian(
      position,
      this.viewer.scene.ellipsoid,
      cartographicScratch,
    );
    const altitude = this.viewer.scene.globe.getHeight(cart);
    cart.height = altitude || 0;
    Cartographic.toCartesian(cart, this.viewer.scene.ellipsoid, position);

    this.uploadedModel.modelMatrix =
      Transforms.eastNorthUpToFixedFrame(position);
  }

  protected shouldUpdate(): boolean {
    return !!this.viewer && !!this.primitiveCollection;
  }

  render(): HTMLTemplateResult {
    return html` <ngv-upload
      .options="${{accept: '.glb,.GLB,.gltf,.GLTF,.ifc,.IFC'}}"
      @uploaded="${(evt: {detail: FileUploadDetails}): void => {
        this.upload(evt.detail).catch((e) =>
          console.error(`Upload error: ${e}`),
        );
      }}"
    ></ngv-upload>`;
  }

  createRenderRoot(): this {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-upload': NgvPluginCesiumUpload;
  }
}
