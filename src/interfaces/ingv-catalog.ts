import {INGVCesiumAllTypes} from './ingv-layers.js';

export interface NGVLayerDescr<Type, LayerType> {
  type: Type;
  options: LayerType;
}

/**
 * A catalog is simply a flat set of layers
 */
export interface INGVCatalog {
  id: string;
  credits: string;
  layers: Record<string, INGVCesiumAllTypes>;
}
