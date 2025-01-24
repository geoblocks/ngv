import type {ISurveyConfig} from './ingv-config-survey.js';

export const config: ISurveyConfig = {
  languages: ['de', 'fr', 'en', 'it'],
  header: {
    title: {
      fr: 'Ma super app',
      en: 'My super app',
      de: 'Meine supper app',
      it: 'Mia super app',
    },
  },
  footer: {
    contact: 'me@example.com',
    impressum: {
      fr: 'Bla bla FR impressim',
      en: 'Bla bla EN impressim',
      de: 'Bla bla DE impressim',
      it: 'Bla bla IT impressim',
    },
  },
  app: {
    survey: [
      {
        id: 'textInput',
        type: 'input',
        inputType: 'text',
        required: true,
        label: 'text test',
        placeholder: 'test',
        min: 1,
        max: 30,
      },
      {
        id: 'numberInput',
        type: 'input',
        label: 'number test',
        inputType: 'number',
        required: true,
        min: 1,
        max: 100,
      },
      {
        id: 'dateInput',
        type: 'input',
        label: 'date test',
        inputType: 'date',
        required: true,
        min: '2025-01-01',
      },
      {
        id: 'textarea',
        type: 'textarea',
        required: true,
        label: 'area test',
        placeholder: 'test',
        min: 1,
        max: 100,
      },
      {
        id: 'radio',
        type: 'radio',
        label: 'radio test',
        defaultValue: 'r1',
        options: [
          {
            label: 'radio 1',
            value: 'r1',
          },
          {
            label: 'radio 2',
            value: 'r2',
          },
        ],
      },
      {
        id: 'checkbox',
        type: 'checkbox',
        label: 'checkbox test',
        required: true,
        options: [
          {
            label: 'checkbox 1',
            value: 'c1',
            checked: false,
          },
          {
            label: 'checkbox 2',
            value: 'c2',
            checked: false,
          },
        ],
      },
      {
        id: 'select',
        type: 'select',
        label: 'select test',
        required: true,
        options: [
          {
            label: 'select 1',
            value: 's1',
          },
          {
            label: 'select 2',
            value: 's2',
          },
        ],
      },
    ],
    cesiumContext: {
      catalogs: {
        '@cesium': () => import('../../catalogs/cesiumCatalog.js'),
        '@demo': () => import('../../catalogs/demoCatalog.js'),
      },
      layers: {
        // tiles3d: ['@demo/castle', '@demo/castle2'],
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
        },
        {
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
