export interface IngvCesiumContext {
  cesiumApiKey?: string;
  baseUrl?: string;
  layers: {
    terrain: string;
    buildings: string;
    vegetation: string;
  };
  initialView: {
    destination: [number, number, number];
    orientation: {
      heading: number;
      pitch: number;
    };
  };
}
