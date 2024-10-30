import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import type {IPermitsConfig} from './ingv-config-permits.js';
import '../../plugins/cesium/ngv-plugin-cesium-widget';
import '../../plugins/cesium/ngv-plugin-cesium-upload';
import '../../plugins/cesium/ngv-plugin-cesium-model-interact';
import type {CesiumWidget, DataSourceCollection, Model} from '@cesium/engine';

import {
  Math as CesiumMath,
  Ellipsoid,
  HeadingPitchRoll,
  Transforms,
  PrimitiveCollection,
} from '@cesium/engine';
import type {ViewerInitializedDetails} from '../../plugins/cesium/ngv-plugin-cesium-widget.js';

@customElement('ngv-app-permits')
@localized()
export class NgvAppPermits extends ABaseApp<IPermitsConfig> {
  @state()
  private viewer: CesiumWidget;
  private primitiveCollection: PrimitiveCollection = new PrimitiveCollection();
  private dataSourceCollection: DataSourceCollection;

  constructor() {
    super(() => import('./demoPermitConfig.js'));
  }

  modelCallback(name: string, model: Model): void {
    // This position the model where the camera is
    console.log('positioning', name);
    const positionClone = this.viewer.camera.position.clone();

    const fixedFrameTransform = Transforms.localFrameToFixedFrameGenerator(
      'north',
      'west',
    );

    const modelOrientation = [90, 0, 0];
    const modelMatrix = Transforms.headingPitchRollToFixedFrame(
      positionClone,
      new HeadingPitchRoll(...modelOrientation.map(CesiumMath.toRadians)),
      Ellipsoid.WGS84,
      fixedFrameTransform,
    );
    model.modelMatrix = modelMatrix;
  }

  render(): HTMLTemplateResult {
    const r = super.render();
    if (r && !this.config) {
      return r;
    }
    return html`
      <ngv-structure-app .config=${this.config}>
        <div
          slot="menu"
          style="display: flex; flex-direction: column; row-gap: 10px;"
        >
          <ngv-plugin-cesium-upload
            .viewer="${this.viewer}"
            .primitiveCollection="${this.primitiveCollection}"
          ></ngv-plugin-cesium-upload>
          <ngv-plugin-cesium-model-interact
            .viewer="${this.viewer}"
            .dataSourceCollection="${this.dataSourceCollection}"
            .primitiveCollection="${this.primitiveCollection}"
          ></ngv-plugin-cesium-model-interact>
        </div>
        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.app.cesiumContext}
          .modelCallback=${this.modelCallback.bind(this)}
          @viewerInitialized=${(evt: CustomEvent<ViewerInitializedDetails>) => {
            this.viewer = evt.detail.viewer;
            this.viewer.scene.primitives.add(this.primitiveCollection);
            this.dataSourceCollection = evt.detail.dataSourceCollection;
          }}
        ></ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }
}
