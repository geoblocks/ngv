import type {IngvCesiumContext} from 'src/interfaces/ingv-cesium-context.js';
import type {INgvStructureApp} from '../../structure/ngv-structure-app.js';

export interface IPermitsConfig extends INgvStructureApp {
  app: {
    cesiumContext: IngvCesiumContext;
  };
}