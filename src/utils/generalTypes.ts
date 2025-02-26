export type Coordinate = {longitude: number; latitude: number; height: number};

export type FieldValues = Record<
  string,
  string | number | Record<string, boolean> | Coordinate
>;
