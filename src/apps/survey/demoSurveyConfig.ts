import type {Coordinates, FieldValues} from '../../utils/generalTypes.js';
import type {
  Context,
  ISurveyConfig,
  Item,
  ItemSummary,
} from './ingv-config-survey.js';
import {Color} from '@cesium/engine';

interface DemoItem extends Item {
  title?: string;
  siteName: string;
  reporter: string;
  dateRecorded: string;
  poiNotes: string;
  urgency: string;
  injuryProbability: string;
  poiCondition: string;
  coordinates: number[];
  poiType: string;
  urgencyColor: string;
}

const prefix = 'ngvfake_';
let maxId = 1;

async function listItems(context: Context): Promise<DemoItem[]> {
  const items = [];
  const {id} = context;
  if (!id) {
    throw new Error('Missing id in context');
  }
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k.startsWith(prefix)) {
      const item = JSON.parse(localStorage.getItem(k)) as DemoItem;
      // @ts-expect-error linter does not like isNaN
      if (!isNaN(item.id) && parseInt(item.id) > maxId) {
        maxId = parseInt(item.id);
      }
      if (item.sitecode === id) {
        items.push(item);
      }
    }
  }
  return Promise.resolve(items);
}

async function getItem(context: Context): Promise<DemoItem> {
  const {id} = context;
  if (!id) {
    throw new Error('Missing id in context');
  }
  const item = localStorage.getItem(prefix + id);
  return Promise.resolve(JSON.parse(item) as DemoItem);
}

async function removeItem(context: Context): Promise<void> {
  const {id} = context;
  if (!id) {
    throw new Error('Missing id in context');
  }
  localStorage.removeItem(prefix + id);
  await Promise.resolve();
}

async function saveItem(item: DemoItem): Promise<{id: string}> {
  // @ts-expect-error linter does not like isNaN
  if (isNaN(item.id)) {
    item.id = (++maxId).toFixed();
  }
  item.reporter = 'Demo user'; // the backend should set this
  localStorage.setItem(prefix + item.id, JSON.stringify(item));
  return Promise.resolve({
    id: item.id,
  });
}

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case 'Not urgent':
      return '#008000';
    case 'Urgent':
      return '#ffff00';
    case 'Very urgent':
      return '#ff0000';
    default:
      return '#808080';
  }
}

export const config: ISurveyConfig<ItemSummary, DemoItem> = {
  languages: ['en'],
  header: {
    title: {
      en: 'Survey app',
    },
  },
  app: {
    survey: {
      listItems: listItems,
      getItem: getItem,
      saveItem: saveItem,
      removeItem: removeItem,
      itemToFields(item: DemoItem) {
        return {
          siteCode: item.sitecode,
          id: item.id,
          title: item.title,
          reporter: item.reporter,
          dateRecorded: item.dateRecorded,
          poiNotes: item.poiNotes,
          urgency: item.urgency,
          injuryProbability: item.injuryProbability,
          poiCondition: item.poiCondition,
          poiType: item.poiType,
          urgencyColor: item.urgencyColor,
          coordinates: {
            wgs84: item.coordinates,
            projected: item.projectedCoordinates,
          },
        };
      },
      fieldsToItem(
        fields: FieldValues,
        viewId?: string,
        _itemNumber?: number,
      ): DemoItem {
        const coos = <Coordinates>fields.coordinates;
        return {
          sitecode: viewId,
          siteName: viewId,
          title: <string>fields.title,
          reporter: <string>fields.reporter,
          coordinates: coos.wgs84,
          dateRecorded: <string>fields.dateRecorded,
          id: <string>fields.id,
          lastModifiedMs: Date.now(),
          poiNotes: <string>fields.poiNotes,
          injuryProbability: <string>fields.injuryProbability,
          poiCondition: <string>fields.poiCondition,
          urgency: <string>fields.urgency,
          projectedCoordinates: coos.projected,
          poiType: <string>fields.poiType,
          urgencyColor: <string>fields.urgencyColor,
        };
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
          required: true,
          inputType: 'datetime-local',
        },
        {
          id: 'title',
          label: 'Title',
          type: 'input',
          inputType: 'text',
        },
        {
          id: 'poiNotes',
          type: 'textarea',
          required: false,
          label: 'Description of POI',
          placeholder: 'Optional free text',
        },
        {
          id: 'poiType',
          type: 'select',
          label: 'POI Type',
          required: true,
          options: [
            {label: 'Wall', value: 'wall'},
            {label: 'Roof', value: 'roof'},
            {label: 'Door', value: 'door'},
            {label: 'Pavement', value: 'pavement'},
          ],
        },
        {
          id: 'poiCondition',
          type: 'radio',
          label: 'Condition',
          defaultValue: '1',
          required: true,
          options: [
            {label: 'Broken', value: '4'},
            {label: 'Almost broken', value: '3'},
            {label: 'OK', value: '2'},
            {label: 'Good', value: '1'},
          ],
        },
        {
          id: 'injuryProbability',
          type: 'select',
          label: 'Can a visitor get injured?',
          required: true,
          options: [
            {
              label: 'No',
              value: '1',
            },
            {
              label: 'Probably no',
              value: '2',
            },
            {
              label: 'Yes',
              value: '3',
            },
          ],
        },
        {
          id: 'urgency',
          type: 'readonly',
          label: 'Fixing urgency',
          options: {
            '1': 'Not urgent',
            '2': 'Not urgent',
            '3': 'Not urgent',
            '4': 'Not urgent',
            '5': 'Urgent',
            '6': 'Urgent',
            '7': 'Urgent',
            '8': 'Urgent',
            '9': 'Very urgent',
            '10': 'Very urgent',
            '11': 'Very urgent',
            '12': 'Very urgent',
          },
          keyCallback: (item: DemoItem): string => {
            const rating =
              Number(item.poiCondition) * Number(item.injuryProbability);
            return rating ? String(rating) : '';
          },
        },
        {
          id: 'urgencyColor',
          type: 'color',
          disabled: true,
          valueCallback: (item: FieldValues): string => {
            return getUrgencyColor(<string>item.urgency);
          },
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
        actionBtnLabel: 'Add POI',
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
      surveyOptions: {
        pointOptions: {
          colorCallback: (values: DemoItem) => {
            return Color.fromCssColorString(getUrgencyColor(values.urgency));
          },
        },
      },
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
