import type {ISurveyConfig} from './ingv-config-survey.js';

export const config: ISurveyConfig = {
  languages: ['en'],
  header: {
    title: {
      en: 'Survey app',
    },
  },
  app: {
    survey: [
      {
        id: 'survey-id',
        type: 'id',
      },
      {
        id: 'coords-field',
        type: 'coordinates',
      },
      {
        id: 'survey-summary',
        type: 'input',
        inputType: 'text',
        required: true,
        label: 'Summary',
        placeholder: 'Summary',
        min: 1,
        max: 50,
      },
      {
        id: 'survey-date',
        type: 'input',
        label: 'Date',
        inputType: 'date',
        required: true,
        min: '2025-01-01',
      },
      {
        id: 'survey-description',
        type: 'textarea',
        required: false,
        label: 'Description',
        placeholder: 'Describe a problem',
        min: 1,
        max: 200,
      },
      {
        id: 'survey-select',
        type: 'select',
        label: 'Defect type',
        required: true,
        options: [
          {
            label: 'Type 1',
            value: 's1',
          },
          {
            label: 'Type 2',
            value: 's2',
          },
        ],
      },
      {
        id: 'survey-radio',
        type: 'radio',
        label: 'Priority',
        defaultValue: 'r1',
        options: [
          {
            label: 'Low',
            value: 'r1',
          },
          {
            label: 'Medium',
            value: 'r2',
          },
          {
            label: 'High',
            value: 'r3',
          },
        ],
      },
      {
        id: 'survey-checkbox',
        type: 'checkbox',
        label: 'Choose options (at least one)',
        required: true,
        options: [
          {
            label: 'Option 1',
            value: 'c1',
            checked: false,
          },
          {
            label: 'Option 2',
            value: 'c2',
            checked: false,
          },
          {
            label: 'Option 3',
            value: 'c3',
            checked: false,
          },
        ],
      },
      {
        id: 'survey-file',
        type: 'file',
        mainBtnText: 'Attach photo',
        urlInput: false,
        fileInput: true,
        uploadBtnText: 'Upload',
        accept: 'image/*',
      },
    ],
    cesiumContext: {
      ionDefaultAccessToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxMWU4YzQzNC00NzMxLTQ0NzktYTFlYi01NjMyMDgwMTMyY2EiLCJpZCI6MjI2NjUyLCJpYXQiOjE3MzkxODcxNTZ9.OJJ_pdI3WDMLO3W4vYWA1aW20DilQ2nyocgItAWPs-g',
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
