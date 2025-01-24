import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import type {INgvStructureApp} from '../../structure/ngv-structure-app.js';
import type {SurveyField} from '../../interfaces/ui/ingv-survey.js';

export interface ISurveyConfig extends INgvStructureApp {
  app: {
    cesiumContext: IngvCesiumContext;
    survey: SurveyField[];
  };
}
