import type {INGVCatalog} from '../interfaces/cesium/ingv-catalog.js';

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
      position: [6.625727097014207, 46.50662035273721],
      height: 374,
      rotation: 45,
    },
    sofa: {
      type: 'model',
      options: {
        url: 'https://raw.GithubUserContent.com/KhronosGroup/glTF-Sample-Assets/main/./Models/SheenWoodLeatherSofa/glTF-Binary/SheenWoodLeatherSofa.glb',
        credit: 'Khonos',
      },
      position: [6.625858407650085, 46.50649671101955],
      height: 374,
      rotation: 239,
    },
    // to complete
  },
};
