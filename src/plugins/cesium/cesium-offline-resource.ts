import {Resource} from '@cesium/engine';
import {
  filenamize,
  getOrCreateDirectoryChain,
} from '../../utils/storage-utils.js';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const Implementations: {loadWithXhr: typeof offlineLoadWithXhr} =
  // @ts-expect-error loader is not part of API
  Resource._Implementations;

const originalFn: typeof offlineLoadWithXhr = Implementations.loadWithXhr;

let is_offline = false;
let app_name = '';
export function setOffline(offline: boolean, appName: string): void {
  is_offline = offline;
  app_name = appName;
  Implementations.loadWithXhr = offlineLoadWithXhr;
}

async function offlineLoadWithXhr(
  url: string,
  responseType: string,
  method: 'GET',
  data: any,
  headers: any,
  deferred: {
    resolve: (p: any) => void;
    reject: (e: Error) => void;
  },
  overrideMimeType: any,
): Promise<void> {
  if (!is_offline) {
    return originalFn(
      url,
      responseType,
      method,
      data,
      headers,
      deferred,
      overrideMimeType,
    );
  }
  const filename = filenamize(url);
  try {
    const directoryHandler = await getOrCreateDirectoryChain([
      app_name,
      'persisted',
    ]);
    const fileHandler = await directoryHandler.getFileHandle(filename, {
      create: false,
    });
    const file = await fileHandler.getFile();

    switch (responseType) {
      case 'text':
        deferred.resolve(await file.text());
        break;
      case 'json': {
        const text = await file.text();
        deferred.resolve(JSON.parse(text));
        break;
      }
      default:
        deferred.resolve(new Uint8Array(await file.arrayBuffer()).buffer);
        break;
    }
  } catch (e: any) {
    deferred.reject(
      new Error(
        `Could not read file ${filename} from filesystem storage: ${e}`,
      ),
    );
    return;
  }

  // const urlObject = new URL(url);
  // const extension = urlObject.pathname.split('.').at(-1);
}
