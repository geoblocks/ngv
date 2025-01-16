import type {INGVCatalog} from '../interfaces/cesium/ingv-catalog.js';

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
    // to complete
  },
};
