import type {
  Cesium3DTileset,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from '@cesium/engine';

import type {CesiumTerrainProvider} from '@cesium/engine';

export type INGVCesiumImageryTypes =
  | INGVCesiumWMSImagery
  | INGVCesiumWMTSImagery
  | INGVCesiumUrlTemplateImagery;

export type INGVCesiumAllTypes =
  | INGVCesium3DTiles
  | INGVCesiumTerrain
  | INGVCesiumImageryTypes;

export interface INGVCesium3DTiles {
  type: '3dtiles';
  subtype?: 'googlePhotorealistic';
  url: string | number;
  options?: ConstructorParameters<typeof Cesium3DTileset>[0];
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
