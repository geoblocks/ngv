import type {Geometry} from 'geojson';

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

// Unions of all possible configs
export type INGVSearchProviderConfigs = INGVGeoAdminSearchProviderConfig;

export interface INGVSearchProvider {
  search: (input: string, lang: string) => Promise<INGVSearchResult[]>;
}
