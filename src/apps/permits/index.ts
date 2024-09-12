import type {HTMLTemplateResult} from 'lit';
import {html} from 'lit';
import {customElement} from 'lit/decorators.js';

import '../../structure/ngv-structure-app.js';

// // @ts-expect-error ?url parameter is a viteJS specificity
// import logoUrl from "../../logo.svg?url";
import {localized} from '@lit/localize';
import {ABaseApp} from '../../structure/BaseApp.js';

import type {IPermitsConfig} from './ingv-config-permits.js';
import '../../plugins/cesium/ngv-plugin-cesium-widget';
import type {CesiumWidget, Model} from '@cesium/engine';

import {
  Math as CesiumMath,
  Ellipsoid,
  HeadingPitchRoll,
  Transforms,
} from '@cesium/engine';

@customElement('ngv-app-permits')
@localized()
export class NgvAppPermits extends ABaseApp<IPermitsConfig> {
  private viewer: CesiumWidget;

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
    if (r) {
      return r;
    }
    return html`
      <ngv-structure-app .config=${this.config}>
        <ngv-plugin-cesium-widget
          .cesiumContext=${this.config.app.cesiumContext}
          .modelCallback=${this.modelCallback.bind(this)}
          @viewerInitialized=${(evt: CustomEvent<CesiumWidget>) => {
            this.viewer = evt.detail;
          }}
        ></ngv-plugin-cesium-widget>
      </ngv-structure-app>
    `;
  }
}
