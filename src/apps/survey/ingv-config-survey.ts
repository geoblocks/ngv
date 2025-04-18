import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import type {INgvStructureApp} from '../../structure/ngv-structure-app.js';
import type {SurveyField} from '../../interfaces/ui/ingv-survey.js';
import type {FieldValues} from '../../utils/generalTypes.js';

export interface ItemSummary {
  id: string;
  lastModifiedMs: number;
  coordinates: number[];
}

export type Context = {
  id: string;
};

export type Item = ItemSummary;

export interface ISurveyConfig<ItemSummaryType = ItemSummary, ItemType = Item>
  extends INgvStructureApp {
  app: {
    cesiumContext: IngvCesiumContext;
    survey: {
      listItems: (context: Context) => Promise<ItemSummaryType[]>;
      getItem: (context: Context) => Promise<ItemType>;
      itemToFields: (item: ItemType) => FieldValues;
      fieldsToItem: (values: FieldValues) => Item;
      fields: SurveyField[];
    };
  };
}
