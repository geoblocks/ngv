import type {
  Cesium3DTileset,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from '@cesium/engine';

import type {CesiumTerrainProvider, Model} from '@cesium/engine';
import type {Cartesian3} from '@cesium/engine';

export type INGVCesiumImageryTypes =
  | INGVCesiumWMSImagery
  | INGVCesiumWMTSImagery
  | INGVCesiumUrlTemplateImagery;

export type INGVCesiumAllTypes =
  | INGVCesiumAllPrimitiveTypes
  | INGVCesiumTerrain
  | INGVCesiumImageryTypes;

export type INGVCesiumAllPrimitiveTypes =
  | INGVCesiumModelConfig
  | INGVIFC
  | INGVCesium3DTiles;

export interface INGVCesium3DTiles {
  type: '3dtiles';
  subtype?: 'googlePhotorealistic';
  url: string | number;
  options?: ConstructorParameters<typeof Cesium3DTileset>[0];
}

export interface INGVCesiumModelConfig {
  type: 'model';
  options?: Parameters<typeof Model.fromGltfAsync>[0];
  position?: [number, number];
  height?: number;
  rotation?: number;
}

export interface INGVCesiumModel extends Model {
  id: {
    dimensions?: Cartesian3;
    name: string;
  };
}

export interface INGVIFC {
  type: 'ifc';
  url: string;
  options?: {
    modelOptions: Omit<INGVCesiumModelConfig['options'], 'url'>;
  };
  position: [number, number];
  height: number;
  rotation: number;
}

export interface INGVCesiumTerrain {
  type: 'terrain';
  url: string | number;
  options?: ConstructorParameters<typeof CesiumTerrainProvider>[0];
}

export interface INGVCesiumWMTSImagery {
  type: 'wmts';
  options?: ConstructorParameters<typeof WebMapTileServiceImageryProvider>[0];
}

export interface INGVCesiumWMSImagery {
  type: 'wms';
  options?: ConstructorParameters<typeof WebMapServiceImageryProvider>[0];
}

export interface INGVCesiumUrlTemplateImagery {
  type: 'urltemplate';
  options?: ConstructorParameters<typeof UrlTemplateImageryProvider>[0];
}
