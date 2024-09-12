import type {INGVCatalog} from '../interfaces/ingv-catalog.js';

export const catalog: INGVCatalog = {
  id: '@demo',
  credits: '© various',
  layers: {
    sofa: {
      type: 'model',
      options: {
        url: 'https://github.com/KhronosGroup/glTF-Sample-Models/raw/main/2.0/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb',
        credit: 'Khonos',
      },
    },
    // to complete
  },
};
