import type {Geometry} from 'geojson';

/**
 * To add a providers, you need to:
 * 1. Create a new provider file in src/plugins/search/providers/ that implements the INGVSearchProvider interface
 * 2. Add the provider to the getProvider function in src/plugins/search/ngv-search-providers.ts
 * 3. Add the provider to the IngvSearchContext in src/interfaces/search/ingv-search-context.ts
 */

export interface INGVSearchResult {
  title: string;

  geom: Geometry;

  // From which provider the result comes from
  provider: string;

  // The provider-specific category, if provided
  category?: string | null;

  extra?: Record<string, any>;
}

export interface INGVGeoAdminSearchProviderConfig {
  type: 'geoadmin';

  options?: {
    sr?: string;
    limit?: number;
    locationOrigins?: string;
  };
}

export function isGeoAdminSearchProvider(
  config: INGVSearchProviderConfigs,
): config is INGVGeoAdminSearchProviderConfig {
  return config.type === 'geoadmin';
}

export interface INGVNominatimSearchProviderConfig {
  type: 'nominatim';

  options?: {
    /** URL to the Nominatim search API. The following placeholders are supported:
     * - `{input}`: the search query
     * - `{lang}`: the language code
     * - `{limit}`: see below
     */
    url?: string;

    /** Maximum number of results to return */
    limit?: number;
  };
}
export function isNominatimSearchProvider(
  config: INGVSearchProviderConfigs,
): config is INGVNominatimSearchProviderConfig {
  return config.type === 'nominatim';
}

// Unions of all possible configs
export type INGVSearchProviderConfigs =
  | INGVGeoAdminSearchProviderConfig
  | INGVNominatimSearchProviderConfig;

export interface INGVSearchProvider {
  search: (input: string, lang: string) => Promise<INGVSearchResult[]>;
}
