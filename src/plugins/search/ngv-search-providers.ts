import type {INGVSearchProvider} from '../../interfaces/search/ingv-search-provider.js';

const factories: Record<string, () => Promise<{provider: INGVSearchProvider}>> =
  {
    // Here we register singletons for builtin providers
    geoadmin: () => import('./ngv-geoadmin-provider.js'),
    // add custom singletons here or through the setter
  };

export function setProviderFunction(
  key: string,
  fn: () => Promise<{provider: INGVSearchProvider}>,
): void {
  factories[key] = fn;
}

export async function getProvider(name: string): Promise<INGVSearchProvider> {
  if (name in factories) {
    const {provider} = await factories[name]();
    return provider;
  }
  return Promise.reject(new Error('No known provider with name ' + name));
}
