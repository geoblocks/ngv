import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import type {INgvStructureApp} from '../../structure/ngv-structure-app.js';

export interface CustomConfig extends INgvStructureApp {
  app: {
    cesiumContext: IngvCesiumContext;
  };
}
