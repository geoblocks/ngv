import type {CesiumWidget} from '@cesium/engine';
import type {INGVCatalog} from './ingv-catalog.js';

export interface IngvCesiumContext {
  cesiumApiKey?: string;
  baseUrl?: string;
  catalogs: Record<
    string,
    INGVCatalog | (() => Promise<{catalog: INGVCatalog}>) | string
  >;
  layers: {
    terrain?: string;
    tiles3d?: string[];
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
  widgetOptions?: ConstructorParameters<typeof CesiumWidget>[1];
}
