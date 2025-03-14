import type {
  CesiumWidget,
  Color,
  Globe,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  Property,
  VerticalOrigin,
} from '@cesium/engine';
import type {INGVCatalog} from './ingv-catalog.js';

export interface IngvCesiumContext {
  name: string;
  ionDefaultAccessToken?: string;
  ionAssetUrl?: string; // required when using layers from Cesium ION and offline plugin. Default: 'https://assets.ion.cesium.com/'
  cesiumApiUrl?: string; // required when using layers from Cesium ION and offline plugin. Default: 'https://api.cesium.com/'
  baseUrl?: string;
  catalogs: Record<
    string,
    INGVCatalog | (() => Promise<{catalog: INGVCatalog}>) | string
  >;
  layers: {
    terrain?: string;
    tiles3d?: string[]; // will be ignored if 3d tiles specified in views
    models?: string[];
    imageries: string[];
  };
  /**
   * These are lists of selected layers.
   */
  quickLists?: {
    // Can we switch terrain?
    terrains?: string[];
    // imageries: string[];
    baseLayers?: string[];
  };
  layerOptions?: Record<string, Record<string, any>>;
  camera: {
    position: [number, number, number];
    orientation: {
      heading: number;
      pitch: number;
    };
  };
  views?: {
    id: string; // should be uniq
    positions: [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ];
    height: number;
    elevation: number;
    title: string;
    flyDuration?: number;
    fovAngle: number;
    highlightColor?: string; // css string, default red
    tiles3d?: string[];
    offline?: {
      rectangle?: number[]; // west, south, east, north
      imageryMaxLevel?: number;
    };
  }[];
  widgetOptions?: ConstructorParameters<typeof CesiumWidget>[1];
  globeOptions?: Partial<Globe>;
  measureOptions?: {
    areaFill?: string;
    lineColor?: string;
    lineWidth?: number;
    showPoints?: boolean;
    pointColor?: string;
    pointOutlineWidth?: number;
    pointOutlineColor?: string;
    pointPixelSize?: number;
    showNEDifference?: boolean;
    showHeightDifferance?: boolean;
    showSegmentsInfo?: boolean;
  };
  clickInfoOptions?: {
    type: 'cesium' | 'html';
    showWgs84?: boolean;
    showAmslElevation?: boolean;
    showTerrainDistance?: boolean;
    projection?: string;
    pointOptions?: {
      show?: boolean;
      color?: string;
      outlineWidth?: number;
      outlineColor?: string;
      pixelSize?: number;
    };
    cesiumLabelOptions?: {
      font?: string;
      style?: LabelStyle;
      showBackground?: boolean;
      verticalOrigin?: VerticalOrigin;
      horizontalOrigin?: HorizontalOrigin;
      disableDepthTestDistance?: number;
      pixelOffset?: {x: number; y: number};
      backgroundPadding?: {x: number; y: number};
      backgroundColor?: string;
    };
    actionBtn?: boolean; // work only with html popup
    actionBtnLabel?: string;
  };
  clippingOptions?: {
    terrainClippingEnabled?: boolean;
    tilesClippingEnabled?: boolean;
    storeKey?: string;
  };
  surveyOptions?: {
    pointOptions?: {
      color?: string | Property;
      colorCallback?: (...args: any[]) => Color;
      outlineWidth?: number;
      outlineColor?: string;
      pixelSize?: number;
      disableDepthTestDistance?: number;
      heightReference?: HeightReference;
    };
    pointHighlightOptions?: {
      color?: string;
      outlineWidth?: number;
      outlineColor?: string;
      pixelSize?: number;
      disableDepthTestDistance?: number;
    };
  };
  offline?: {
    infoFilename: string;
    imagerySubdir: string;
    tiles3dSubdir: string;
  };
}
