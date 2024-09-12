import type {INGVCatalog} from '../interfaces/ingv-catalog.js';

export const catalog: INGVCatalog = {
  id: '@demo',
  credits: '© various',
  layers: {
    thatopensmall: {
      type: 'ifc',
      url: 'https://thatopen.github.io/engine_components/resources/small.ifc',
      options: {
        modelOptions: {
          credit: 'test',
        },
      },
    },
    sofa: {
      type: 'model',
      options: {
        url: 'https://raw.GithubUserContent.com/KhronosGroup/glTF-Sample-Assets/main/./Models/SheenWoodLeatherSofa/glTF-Binary/SheenWoodLeatherSofa.glb',
        credit: 'Khonos',
      },
    },
    // to complete
  },
};
