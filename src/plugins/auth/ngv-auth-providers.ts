import type {IngvAuthProvider} from '../../interfaces/auth/ingv-auth-provider.js';

const factories: Record<string, () => Promise<{provider: IngvAuthProvider}>> = {
  // Here we register singletons for builtin providers
  oidc: () => import('./ngv-auth-oidcjs-provider.js'),
  // add custom singletons here or through the setter
};

export async function getProvider(name: string): Promise<IngvAuthProvider> {
  if (name in factories) {
    const {provider} = await factories[name]();
    return provider;
  }
  return Promise.reject(new Error('No known provider with name ' + name));
}
