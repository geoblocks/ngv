import {LitElement, css, unsafeCSS, html} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

import {
  Ion,
  Math as CesiumMath,
  CesiumWidget,
  Cartesian3,
  CesiumTerrainProvider,
  Terrain,
  ShadowMode,
  Cesium3DTileset,
} from '@cesium/engine';

// @ts-expect-error Vite specific ?inline parameter
import style from '@cesium/engine/Source/Widget/CesiumWidget.css?inline';
import {IngvCesiumContext} from 'src/interfaces/ingv-cesium-context.js';

/**
 * FIXME: this is really specific:
 * - it has a not very flexible set of layers;
 * - there is no concept of a catalog / identifier
 * - it hardcodes dependency on various types: terrain, 3dtiles, ... (maybe fine?)
 * - it forces shadows, backfaceculling, ...
 */
async function initCesium(
  container: HTMLDivElement,
  config: IngvCesiumContext,
): Promise<CesiumWidget> {
  window.CESIUM_BASE_URL = config.baseUrl || '/';

  if (config.cesiumApiKey) {
    Ion.defaultAccessToken = config.cesiumApiKey;
  }

  window.CESIUM_BASE_URL = '/';
  const {
    terrain: terrainUrl,
    buildings: buildingsUrl,
    vegetation: vegetationUrl,
  } = config.layers;
  const initialView = config.initialView;

  const viewer = new CesiumWidget(container, {
    shadows: true,
    scene3DOnly: true,
    terrain: new Terrain(CesiumTerrainProvider.fromUrl(terrainUrl)),
    terrainShadows: ShadowMode.ENABLED,
  });
  const scene = viewer.scene;
  const buildingsTS = await Cesium3DTileset.fromUrl(buildingsUrl, {
    show: true,
    backFaceCulling: false,
  });
  scene.primitives.add(buildingsTS);
  const vegetationTS = await Cesium3DTileset.fromUrl(vegetationUrl, {
    show: true,
    backFaceCulling: false,
  });
  scene.primitives.add(vegetationTS);

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(...initialView.destination),
    orientation: {
      heading: CesiumMath.toRadians(initialView.orientation.heading),
      pitch: CesiumMath.toRadians(initialView.orientation.pitch),
    },
    duration: 0,
  });

  return viewer;
}

@customElement('ngv-plugin-cesium-widget')
export class NgvPluginCesiumWidget extends LitElement {
  public viewer: CesiumWidget;

  static styles = css`
    ${unsafeCSS(style)}

    :host {
      width: 100%;
      height: 100%;
      display: block;
    }
    .cesium-credit-logoContainer {
      display: none !important;
    }
  `;

  @property({type: Object})
  config: IngvCesiumContext;

  // The configuration should provide a catalog
  @query('#globe')
  private element: HTMLDivElement;

  protected async firstUpdated(): Promise<void> {
    this.viewer = await initCesium(this.element, this.config);
  }

  render() {
    return html`<div id="globe"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ngv-plugin-cesium-widget': NgvPluginCesiumWidget;
  }
}

declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}
