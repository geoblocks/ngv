import type {CesiumWidget, Model, PrimitiveCollection} from '@cesium/engine';
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
import {
  storeBlobInIndexedDB,
  updateModelsInLocalStore,
} from '../../apps/permits/localStore.js';

const cartographicScratch = new Cartographic();

type GlbJson = {
  bufferViews: {byteOffset: number; byteLength: number}[];
  accessors: {bufferView: number}[];
  meshes: {
    primitives: {
      attributes: {
        POSITION: number;
      };
    }[];
  }[];
};

export interface UploadedModel extends Model {
  id: {
    dimensions?: Cartesian3;
    name: string;
  };
}

@customElement('ngv-plugin-cesium-upload')
export class NgvPluginCesiumUpload extends LitElement {
  @property({type: Object})
  private viewer: CesiumWidget;
  @property({type: Object})
  private primitiveCollection: PrimitiveCollection;
  private eventHandler: ScreenSpaceEventHandler | null = null;
  private uploadedModel: Model | undefined;

  async upload(fileDetails: FileUploadDetails): Promise<void> {
    const response = await fetch(fileDetails.url);
    const arrayBuffer = await response.arrayBuffer();
    const dimensions = parseGlbModelDimensions(arrayBuffer);

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
        url: fileDetails.url,
        scene: this.viewer.scene,
        modelMatrix,
        id: {
          name: fileDetails.name,
          dimensions,
        },
      },
    });
    await storeBlobInIndexedDB(new Blob([arrayBuffer]), fileDetails.name);
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
    // todo improve
    const models: Model[] = [];
    for (let i = 0; i < this.primitiveCollection.length; i++) {
      models.push(<Model>this.primitiveCollection.get(i));
    }
    updateModelsInLocalStore(models);
  }

  onMouseMove(event: ScreenSpaceEventHandler.MotionEvent): void {
    const position = this.viewer.scene.pickPosition(event.endPosition);
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
      .options="${{accept: '.glb,.GLB'}}"
      @uploaded="${(evt: {detail: FileUploadDetails}): void => {
        this.upload(evt.detail).catch((e) =>
          console.error(`Upload error: ${e}`),
        );
      }}"
    ></ngv-upload>`;
  }
}

function parseGlbModelDimensions(arrayBuffer: ArrayBuffer): Cartesian3 {
  const glb = new Uint8Array(arrayBuffer);

  const jsonLength = new DataView(arrayBuffer, 12, 4).getUint32(0, true);
  const jsonChunk = new TextDecoder().decode(glb.subarray(20, 20 + jsonLength));
  const json: GlbJson = JSON.parse(jsonChunk) as GlbJson;

  const bufferView =
    json.bufferViews[
      json.accessors[json.meshes[0].primitives[0].attributes.POSITION]
        .bufferView
    ];
  const byteOffset = bufferView.byteOffset;
  const byteLength = bufferView.byteLength;

  const binaryData = new Float32Array(
    arrayBuffer,
    byteOffset + 20 + jsonLength,
    byteLength / Float32Array.BYTES_PER_ELEMENT,
  );

  const min = new Cartesian3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  );
  const max = new Cartesian3(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  );

  for (let i = 0; i < binaryData.length; i += 3) {
    const vertex = new Cartesian3(
      binaryData[i],
      binaryData[i + 2],
      binaryData[i + 1],
    );

    Cartesian3.minimumByComponent(min, vertex, min);
    Cartesian3.maximumByComponent(max, vertex, max);
  }

  return Cartesian3.subtract(max, min, new Cartesian3());
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-upload': NgvPluginCesiumUpload;
  }
}
