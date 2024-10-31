import type {Geometry} from 'geojson';

export interface INGVSearchResult {
  title: string;
  geom: Geometry;
  extra?: Record<string, any>;
}

export interface INGVSearchProvider {
  search: (input: string, lang: string) => Promise<INGVSearchResult[]>;
}
