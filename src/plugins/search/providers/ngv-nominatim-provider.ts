import type {Geometry} from 'geojson';
import type {
  INGVNominatimSearchProviderConfig,
  INGVSearchProvider,
  INGVSearchResult,
} from '../../../interfaces/search/ingv-search-provider.js';

const nominatimSearchUrl =
  'https://nominatim.openstreetmap.org/search?q={input}&accept-language={lang}&limit={limit}&format=jsonv2';

interface OSMFeature {
  display_name: string;
  lat: string;
  lon: string;
}

export class NGVNominatimSearchProvider implements INGVSearchProvider {
  public name: 'nominatim';
  private searchUrl: string;
  private limit: number;

  constructor(
    config: INGVNominatimSearchProviderConfig['options'] | undefined,
  ) {
    this.searchUrl = config?.url ?? nominatimSearchUrl;
    this.limit = config?.limit ?? 10;
  }
  async search(input: string, lang: string): Promise<INGVSearchResult[]> {
    const searchUrl = this.searchUrl
      .replace('{lang}', lang)
      .replace('{limit}', this.limit.toString())
      .replace('{input}', input);
    const response = await fetch(encodeURI(searchUrl));
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
