import {precacheAndRoute, cleanupOutdatedCaches} from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// workbox logs are too annoying
(self as unknown as Record<string, unknown>).__WB_DISABLE_DEV_LOGS = true;

cleanupOutdatedCaches();

// self.__WB_MANIFEST is default injection point
precacheAndRoute(self.__WB_MANIFEST);
