import type {FieldValues} from '../../utils/generalTypes.js';
import type {ISurveyConfig, Item, ItemSummary} from './ingv-config-survey.js';

// todo cors issue

type HESTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type HESDefectItem = {
  defect_id: number;
  event_id: number;
  event_type_code: string;
  event_type: 'High-Level Fabric Inspection';
  hlf_defect_id: string;
  site_id: number;
  site_code: string;
  site_name: string;
  title: string;
  notes: string;
  defect_type_code: 'dtMasonBrick';
  defect_type: 'Masonry & Brickwork';
  section?: null;
  defect_status_code: 'dsOpen';
  defect_status: 'Open';
  defect_priority_code: 'dpLow';
  defect_priority: 'Low';
  residual_risk_rating: number; // RiskRating_Descriptions.csv
  fall_probability: 1 | 2 | 3 | 4 | 5; // ProbabilityDescription.csv
  fall_consequence: 1 | 2 | 3 | 4 | 5; // ConsequenceDescription.csv
  material_code: 'dmMasonry';
  // todo ? check if values correct
  defect_material:
    | 'Masonry'
    | 'Masonry - Drystone'
    | 'Timber'
    | 'Metal'
    | 'Glass'
    | 'Other';
  reporter?: string;
  date_recorded: string;
  entered_dt: string;
  entered_by: string;
  updated_dt: string;
  updated_by: string;
  ref_no?: string;
  entered_by_name?: string;
  entered_by_email?: string;
  updated_by_name?: string;
  updated_by_email?: string;
  elevation: number;
  long_degrees: number;
  lat_degrees: number;
  ll_geojson: string;
};

type HESDefectsResponse = {
  items: HESDefectItem[];
  hasMore: boolean;
  limit: number;
  offset: number;
  count: number;
  links: [
    {
      rel: 'self';
      href: string;
    },
    {
      rel: 'describedby';
      href: string;
    },
    {
      rel: 'first';
      href: string;
    },
    {
      rel: 'next';
      href: string;
    },
  ];
};

function getHESSecretKey() {
  const urlSP = new URLSearchParams(document.location.search);
  let sk = urlSP.get('hes_secret');
  if (!sk) {
    console.log('No hes_secret param, trying to use localstorage');
    sk = localStorage.getItem('hes_secret');
  }
  if (!sk) {
    console.error('No hes_secret in localstorage');
  }
  localStorage.setItem('hes_secret', sk);
  if (urlSP.has('hes_secret')) {
    urlSP.delete('hes_secret')
    document.location.search = urlSP.toString();
  }
  return sk;
}

const hesSecretKey = getHESSecretKey();
let bearerCache = {
  expire_ms: 0,
  token: '',
};

async function getHESBearerToken(): Promise<string> {
  const now = Date.now();
  if (now - 60_000 < bearerCache.expire_ms) {
    return Promise.resolve(bearerCache.token);
  }
  const headers = new Headers();
  headers.append('Content-Type', 'application/x-www-form-urlencoded');
  console.log('Getting bearer token using', hesSecretKey);
  headers.append('Authorization', `Basic ${btoa(hesSecretKey)}`);

  const urlencoded = new URLSearchParams();
  urlencoded.append('grant_type', 'client_credentials');

  //todo remove cors-anywhere host
  const response = await fetch('/api/oauth/token', {
    method: 'POST',
    headers: headers,
    body: urlencoded,
  });
  const res: HESTokenResponse = <HESTokenResponse>await response.json();
  const {access_token, expires_in} = res;
  bearerCache = {
    expire_ms: Date.now() + expires_in * 1000,
    token: access_token,
  };
  return access_token;
}

async function getFromHES<T>(path: string): Promise<T> {
  const token = await getHESBearerToken();
  const myHeaders = new Headers();
  myHeaders.append('Authorization', `Bearer ${token}`);

  // Use todo remove cors-anywhere host
  const response = await fetch(`/api${path}`, {
    method: 'GET',
    headers: myHeaders,
  });
  return <T>await response.json();
}

async function getHESSurveys(siteId: string): Promise<ItemSummary[]> {
  // FIXME: why do we limit the inspection type?
  // &inspection_type=evHLFInsp
  const result = await getFromHES<HESDefectsResponse>(
    `/picams-external/list_defects?site_code=${siteId}&limit=100000`,
  );
  return result['items']
    .filter(
      (s) => s.lat_degrees && s.long_degrees && s.elevation && s.updated_dt,
    )
    .map((s) => ({
      id: s.defect_id.toString(),
      title: s.title,
      // FIXME: flatten and convert to radians?
      coordinates: [s.long_degrees, s.lat_degrees, s.elevation],
      lastModifiedMs: new Date(s.updated_dt).getTime(),
    }));
}

async function getHESSurvey(defectId: string): Promise<Item> {
  const result = await getFromHES<HESDefectsResponse>(
    `/picams-external/defect?defect_id=${defectId}`,
  );
  const s = result['items'][0];
  return {
    id: s.defect_id.toString(),
    title: s.title,
    // FIXME: flatten and convert to radians?
    coordinates: [s.long_degrees, s.lat_degrees, s.elevation],
    lastModifiedMs: new Date(s.updated_dt).getTime(),
    // FIXME: add all other values
  };
}

async function getHESFieldOptions(type: string) {
  const result = await getFromHES<{
    items: {
      code: string,
      code_text: string,
    }[],
  }>(`/picams-external/list_lkup?code_type=${type}`);
  return result.items.map(item => ({
    label: item.code_text,
    value: item.code,
  }))
}


export const config: ISurveyConfig = {
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
        // move function in this file
        return getHESSurveys(id);
      },
      async getItem(id, _) {
        // move function in this file
        return getHESSurvey(id);
      },
      fieldsToItem(_: FieldValues) {
        throw new Error('not implemented');
      },
      itemToFields(item: Item) {
        const c = item.coordinates;
        const values: FieldValues = {
          'survey-id': item.id,
          'coords-field': {
            longitude: c[0],
            latitude: c[1],
            height: c[2],
          },
          'survey-summary': item.title,
        };
        return values;
      },
      fields: [
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
          options: getHESFieldOptions.bind(undefined, 'DEFECT_PRIORITY'),
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
    },
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
          id: 'PIC142',
          positions: [
            [-2.3748860169453025, 55.93951576485856],
            [-2.3755178087172557, 55.939443714659156],
            [-2.375594995947313, 55.93965025820549],
            [-2.3749574866027636, 55.9397255102316],
          ],
          height: 40,
          elevation: 0,
          flyDuration: 2,
          title: 'Dunglass Collegiate Church',
          fovAngle: 45,
          tiles3d: [],
          offline: {
            rectangle: [-5.51792, 57.273, -5.51372, 57.27516],
            imageryMaxLevel: 16,
          },
        },
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
