import {INgvStructureApp} from '../../structure/ngv-structure-app.js';

export interface IIlluminationConfig extends INgvStructureApp {
  app: {
    terrain: string;
    buildings: string;
    vegetation: string;
    initialView: {
      destination: [number, number, number];
      orientation: {
        heading: number;
        pitch: number;
      };
    };
  };
}
