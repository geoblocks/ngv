import type {
  Cesium3DTileset,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from '@cesium/engine';

import type {CesiumTerrainProvider, Model} from '@cesium/engine';

export type INGVCesiumImageryTypes =
  | INGVCesiumWMSImagery
  | INGVCesiumWMTSImagery
  | INGVCesiumUrlTemplateImagery;

export type INGVCesiumAllTypes =
  | INGVCesiumAllPrimitiveTypes
  | INGVCesiumTerrain
  | INGVCesiumImageryTypes;

export type INGVCesiumAllPrimitiveTypes =
  | INGVCesiumModel
  | INGVIFC
  | INGVCesium3DTiles;

export interface INGVCesium3DTiles {
  type: '3dtiles';
  subtype?: 'googlePhotorealistic';
  url: string | number;
  options?: ConstructorParameters<typeof Cesium3DTileset>[0];
}

export interface INGVCesiumModel {
  type: 'model';
  options?: Parameters<typeof Model.fromGltfAsync>[0];
}

export interface INGVIFC {
  type: 'ifc';
  url: string;
  options?: {
    modelOptions: Omit<INGVCesiumModel['options'], 'url'>;
  };
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