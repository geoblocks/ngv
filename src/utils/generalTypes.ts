import type {TemplateResult} from 'lit';

export type Coordinates = {
  wgs84: number[];
  projected?: number[];
};

export type FieldValues = Record<
  string,
  | string
  | number
  | Record<string, boolean>
  | Coordinates
  | number[]
  | TemplateResult<1>
>;
