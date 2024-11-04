import type {Geometry} from 'geojson';
import type {
  INGVOsmSearchProviderConfig,
  INGVSearchProvider,
  INGVSearchResult,
} from '../../../interfaces/search/ingv-search-provider.js';

const nominatimSearchUrl =
  'https://nominatim.openstreetmap.org/search?q={input}&accept-language={lang}&format=jsonv2';

interface OSMFeature {
  display_name: string;
  lat: string;
  lon: string;
}

export class NGVOsmSearchProvider implements INGVSearchProvider {
  public name: 'osm';
  private searchUrl: string;

  constructor(config: INGVOsmSearchProviderConfig['options'] | undefined) {
    this.searchUrl = config?.url ?? nominatimSearchUrl;
  }
  async search(input: string, lang: string): Promise<INGVSearchResult[]> {
    const searchUrl = this.searchUrl
      .replace('{lang}', lang)
      .replace('{input}', input);
    const response = await fetch(searchUrl);
    const features = (await response.json()) as OSMFeature[];
    return features.map((feature: OSMFeature): INGVSearchResult => {
      const geom = {
        type: 'Point',
        coordinates: [parseFloat(feature.lon), parseFloat(feature.lat)],
      };
      return {
        title: feature.display_name,
        provider: this.name,
        geom: geom as Geometry,
      };
    });
  }
}
