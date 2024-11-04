// FIXME: implement some interface?
import type {Geometry} from 'geojson';

import type {
  INGVGeoAdminSearchProviderConfig,
  INGVSearchProvider,
  INGVSearchResult,
} from '../../../interfaces/search/ingv-search-provider.js';

const baseUrl = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const searchUrl = `${baseUrl}?geometryFormat=geojson&sr={sr}&lang={lang}&limit={limit}&searchText={input}`;
const locationSearchUrl = `${searchUrl}&type=locations&origins={origins}`;

interface GAFeature {
  properties: {
    label: string;
  };
  geometry: Geometry;
}

export class NGVGeoAdminSearchProvider implements INGVSearchProvider {
  public name: 'geoadmin';
  private locationOrigins: string;
  private limit: number;
  private sr: string = '4326';

  constructor(config: INGVGeoAdminSearchProviderConfig['options'] | undefined) {
    this.sr = config?.sr ?? '4326';
    this.limit = config?.limit ?? 10;
    this.locationOrigins = config?.locationOrigins ?? 'zipcode,gg25';
  }

  async search(text: string, lang: string): Promise<INGVSearchResult[]> {
    const searchUrl = locationSearchUrl
      .replace('{lang}', lang)
      .replace('{input}', text)
      .replace('{sr}', this.sr)
      .replace('{limit}', this.limit.toString())
      .replace('{origins}', this.locationOrigins);

    const response = await fetch(searchUrl);
    const json = (await response.json()) as {features: GAFeature[]};

    return json.features.map((feature) => {
      return {
        title: feature.properties.label
          .replace(/<i>.*<\/i>/g, '')
          .replace(/<\/?b>/g, ''),
        provider: this.name,
        geom: feature.geometry,
      };
    });
  }
}
