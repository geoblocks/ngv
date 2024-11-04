import {
  isGeoAdminSearchProvider,
  isNominatimSearchProvider,
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
  } else if (isNominatimSearchProvider(config)) {
    const {NGVNominatimSearchProvider} = await import(
      './providers/ngv-nominatim-provider.js'
    );
    return new NGVNominatimSearchProvider(config.options);
  }
  throw new Error(`Unhandled search provider type`);
}
