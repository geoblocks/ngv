import {
  isGeoAdminSearchProvider,
  isOsmSearchProvider,
  type INGVSearchProvider,
  type INGVSearchProviderConfigs,
} from '../../interfaces/search/ingv-search-provider.js';

export async function getProvider(
  config: INGVSearchProviderConfigs,
): Promise<INGVSearchProvider> {
  if (isGeoAdminSearchProvider(config)) {
    const {NGVGeoAdminSearchProvider} = await import(
      './providers/ngv-geoadmin-provider.js'
    );
    return new NGVGeoAdminSearchProvider(config.options);
  } else if (isOsmSearchProvider(config)) {
    const {NGVOsmSearchProvider} = await import(
      './providers/ngv-osm-provider.js'
    );
    return new NGVOsmSearchProvider(config.options);
  }
  throw new Error(`Unhandled search provider type`);
}
