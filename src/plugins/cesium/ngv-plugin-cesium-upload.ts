import type {CesiumWidget, Model, PrimitiveCollection} from '@cesium/engine';
import {
  Cartesian3,
  Cartographic,
  HeadingPitchRoll,
  HeightReference,
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
import {FileUploadDetails} from '../ui/ngv-upload.js';

const cartographicScratch = new Cartographic();

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
    const glb = new Uint8Array(arrayBuffer);

    // Extract JSON chunk and binary chunk
    const jsonLength = new DataView(arrayBuffer, 12, 4).getUint32(0, true);
    const jsonChunk = new TextDecoder().decode(
      glb.subarray(20, 20 + jsonLength),
    );
    const json = JSON.parse(jsonChunk);
    console.log(json);

    // Now access the binary data buffer view for vertex positions
    const bufferView =
      json.bufferViews[
        json.accessors[json.meshes[0].primitives[0].attributes.POSITION]
          .bufferView
      ];
    const byteOffset = bufferView.byteOffset;
    const byteLength = bufferView.byteLength;

    // Extract the vertex data from the binary chunk (after JSON chunk)
    const binaryData = new Float32Array(
      arrayBuffer,
      byteOffset + 20 + jsonLength,
      byteLength / Float32Array.BYTES_PER_ELEMENT,
    );

    // Initialize AABB min/max values
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

    // Iterate over the vertex positions and compute the AABB
    for (let i = 0; i < binaryData.length; i += 3) {
      const vertex = new Cartesian3(
        binaryData[i],
        binaryData[i + 2],
        binaryData[i + 1],
      );

      // Update AABB min and max
      Cartesian3.minimumByComponent(min, vertex, min);
      Cartesian3.maximumByComponent(max, vertex, max);
    }

    // Compute dimensions (width, height, depth)
    const dimensions = Cartesian3.subtract(max, min, new Cartesian3());

    const modelOrientation = [90, 0, 0];
    const modelMatrix = Matrix4.fromTranslationRotationScale(
      new TranslationRotationScale(
        Cartesian3.ZERO,
        Quaternion.fromHeadingPitchRoll(
          new HeadingPitchRoll(...modelOrientation.map(CesiumMath.toRadians)),
        ),
      ),
    );

    // const modelMatrix = new Matrix4();
    //
    // json.nodes.forEach((node) => {
    //   if (!node.matrix) return;
    //   const matrix = new Matrix4(...node.matrix);
    //   Matrix4.add(modelMatrix, matrix, modelMatrix);
    // });

    this.uploadedModel = await instantiateModel({
      type: 'model',
      options: {
        url: fileDetails.url,
        scene: this.viewer.scene,
        modelMatrix,
        id: {
          name: fileDetails.name,
          dimensions,
          min,
          max,
        },
      },
    });
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
      @uploaded="${(evt: {detail: FileUploadDetails}): void => {
        this.upload(evt.detail);
      }}"
    ></ngv-upload>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-upload': NgvPluginCesiumUpload;
  }
}
