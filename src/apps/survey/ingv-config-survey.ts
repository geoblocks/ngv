import type {IngvCesiumContext} from '../../interfaces/cesium/ingv-cesium-context.js';
import type {INgvStructureApp} from '../../structure/ngv-structure-app.js';
import type {SurveyField} from '../../interfaces/ui/ingv-survey.js';
import type {FieldValues} from '../../utils/generalTypes.js';

export interface ItemSummary {
  id: string;
  lastModifiedMs: number;
  coordinates: number[];
  projectedCoordinates: number[];
  modifiedOffline?: boolean;
  title?: string;
  sitecode?: string | number;
}

export type Context = {
  id: string;
};

export type Item = ItemSummary;

export type ItemSaveResponse = {
  id?: string;
  message?: string;
};

export interface ISurveyConfig<
  ItemSummaryType = ItemSummary,
  ItemType = Item,
  ItemSaveResponseType = ItemSaveResponse,
> extends INgvStructureApp {
  app: {
    cesiumContext: IngvCesiumContext;
    survey: {
      listItems: (context: Context) => Promise<ItemSummaryType[]>;
      getItem: (context: Context) => Promise<ItemType>;
      saveItem: (context: ItemType) => Promise<ItemSaveResponseType>;
      itemToFields: (item: ItemType) => FieldValues;
      fieldsToItem: (
        fields: FieldValues,
        viewId?: string,
        itemNumber?: number,
      ) => ItemType;
      fields: SurveyField[];
    };
  };
}
