import type {FieldValues} from '../../utils/generalTypes.js';
import type {
  Context,
  ISurveyConfig,
  Item,
  ItemSummary,
} from './ingv-config-survey.js';

export const config: ISurveyConfig<ItemSummary, Item> = {
  languages: ['en'],
  header: {
    title: {
      en: 'Survey app',
    },
  },
  app: {
    survey: {
      async listItems(context) {
        const {id} = context;
        if (!id) {
          throw new Error('Missing id in context');
        }
        return Promise.resolve([]);
      },
      async getItem(context: Context) {
        console.log(context);
        return Promise.resolve({
          id: context.id,
          coordinates: [],
          lastModifiedMs: Date.now(),
          projectedCoordinates: [],
        });
      },
      async saveItem(item: Item) {
        // todo
        console.log('not implemented', item);
        return Promise.resolve({});
      },
      itemToFields(item: Item) {
        // todo
        console.log('not implemented', item);
        return {};
      },
      fieldsToItem(
        fields: FieldValues,
        viewId?: string,
        itemNumber?: number,
      ): Item {
        // todo
        console.log('not implemented', fields, viewId, itemNumber);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return {};
      },
      fields: [
        {
          id: 'siteCode',
          label: 'Site code',
          type: 'readonly',
        },
        {
          id: 'siteName',
          label: 'Site name',
          type: 'readonly',
        },
        {
          id: 'id',
          label: 'POI ID',
          type: 'id',
        },
        {
          id: 'reporter',
          label: 'Reporter',
          type: 'readonly',
        },
        {
          id: 'dateRecorded',
          type: 'input',
          label: 'Date',
          inputType: 'datetime-local',
        },
        {
          id: 'defectNotes',
          type: 'textarea',
          required: false,
          label: 'Description of defect',
          placeholder: 'Optional free text',
        },
        {
          id: 'coordinates',
          type: 'coordinates',
        },
      ],
    },
    cesiumContext: {
      ionDefaultAccessToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhYWI5OThhNS04YmFhLTQxNmQtOGZjMC1iNDNmMTNlMmYwYzkiLCJpZCI6MjY5NDg1LCJpYXQiOjE3MzcwMzgyNzl9.ruI2nAUv00XwzUSNqf7pX5yip6l89eAyF0FmZbmlrpY',
      name: 'survey',
      catalogs: {
        '@cesium': () => import('../../catalogs/cesiumCatalog.js'),
        '@demo': () => import('../../catalogs/demoCatalog.js'),
      },
      layers: {
        // tiles3d: ['@cesium/castle', '@cesium/castle2'],
        imageries: ['@cesium/openstreetmap'],
      },
      quickLists: {
        baseLayers: ['@cesium/openstreetmap'],
      },
      camera: {
        position: [-5.517543730925392, 57.27447291204438, 1000],
        orientation: {
          heading: 0,
          pitch: -30.0,
        },
      },
      views: [
        {
          id: 'eilean-donan-castle',
          positions: [
            [-5.517543730925392, 57.27447291204438],
            [-5.516081775796481, 57.27485081768119],
            [-5.514924238059451, 57.27369880290402],
            [-5.516224588893907, 57.273339171861174],
          ],
          height: 40,
          elevation: 0,
          flyDuration: 2,
          title: 'Eilean Donan Castle',
          fovAngle: 45,
          tiles3d: ['@cesium/castle'],
          offline: {
            rectangle: [-5.51792, 57.273, -5.51372, 57.27516],
            imageryMaxLevel: 16,
          },
        },
        {
          id: 'blackness-castle-falkirk',
          positions: [
            [-3.5167084426199935, 56.00594918805265],
            [-3.516120373893856, 56.005744756484745],
            [-3.5153586268392725, 56.006330790752074],
            [-3.5157395003694356, 56.00656588340325],
          ],
          height: 30,
          elevation: 0,
          flyDuration: 2,
          title: 'Blackness Castle - Falkirk',
          fovAngle: 45,
          tiles3d: ['@cesium/castle2'],
          offline: {
            rectangle: [-3.51868, 56.00386, -3.51352, 56.00704],
            imageryMaxLevel: 16,
          },
        },
      ],
      layerOptions: {},
      widgetOptions: {
        scene3DOnly: true,
      },
      globeOptions: {
        depthTestAgainstTerrain: true,
      },
      clickInfoOptions: {
        type: 'html',
        showWgs84: true,
        showAmslElevation: true,
        showTerrainDistance: false,
        projection: 'EPSG:27700',
        actionBtn: true,
        actionBtnLabel: 'Add defect',
      },
      measureOptions: {
        showSegmentsInfo: true,
        showHeightDifferance: true,
      },
      clippingOptions: {
        tilesClippingEnabled: true,
        terrainClippingEnabled: false,
        storeKey: 'survey-localStoreClipping',
      },
      offline: {
        infoFilename: 'offline-info',
        tiles3dSubdir: 'tiles3d',
        imagerySubdir: 'imageries',
      },
      surveyOptions: {},
    },
  },
  projections: [
    {
      projection: [
        'EPSG:27700',
        '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +no_defs +nadgrids=OSTN15_NTv2_OSGBtoETRS',
      ],
      gridKey: 'OSTN15_NTv2_OSGBtoETRS',
      gridUrl: '/OSTN15_NTv2_OSGBtoETRS.gsb',
    },
  ],
};
