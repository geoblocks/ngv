import {INGVCatalog} from '../interfaces/ingv-catalog.js';

export const catalog: INGVCatalog = {
  id: '@geoadmin',
  credits: '© Swisstopo',
  layers: {
    terrain: {
      type: 'terrain',
      url: 'https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/',
    },
    buildings: {
      type: '3dtiles',
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20201020/tileset.json',
    },
    vegetation: {
      type: '3dtiles',
      url: 'https://vectortiles.geo.admin.ch/3d-tiles/ch.swisstopo.vegetation.3d/20190313/tileset.json',
    },
    'pixel-karte-farbe': {
      type: 'wmts',
      options: {
        url: 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}',
        layer: 'ch.swisstopo.pixelkarte-farbe',
        dimensions: {
          timestamp: 'current',
        },
        format: 'jpeg',
        style: 'what is this?',
        tileMatrixSetID: 'idem',
        maximumLevel: 18,
      },
    },
    swissimage: {
      type: 'urltemplate',
      options: {
        url: 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}',
        customTags: {
          layer: 'ch.swisstopo.swissimage',
          timestamp: 'current',
          format: 'jpeg',
        },
        maximumLevel: 20,
      },
    },
  },
};
