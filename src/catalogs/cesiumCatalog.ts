import type {INGVCatalog} from '../interfaces/cesium/ingv-catalog.js';

export const ION_ASSETS_URL = 'https://assets.ion.cesium.com/';
export const CESIUM_ASSETS_ENDPOINT =
  'https://api.cesium.com/v1/assets/{id}/endpoint';

export const catalog: INGVCatalog = {
  id: '@cesium',
  credits: '© Cesium',
  layers: {
    googlePhotorealistic: {
      type: '3dtiles',
      subtype: 'googlePhotorealistic',
      url: '',
    },
    openstreetmap: {
      type: 'openstreetmap',
      options: {
        url: 'https://tile.openstreetmap.org/',
      },
    },
    castle: {
      type: '3dtiles',
      url: 2980529,
    },
    castle2: {
      type: '3dtiles',
      url: 3008675,
    },
    dunglass: {
      type: '3dtiles',
      url: 3309935,
    },
    // to complete
  },
};
