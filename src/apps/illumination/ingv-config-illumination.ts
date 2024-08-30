import {IngvCesiumContext} from 'src/interfaces/ingv-cesium-context.js';
import {INgvStructureApp} from '../../structure/ngv-structure-app.js';

export interface IIlluminationConfig extends INgvStructureApp {
  app: {
    cesiumContext: IngvCesiumContext;
  };
}
