import type {FieldValues} from '../../utils/generalTypes.js';
import type {
  Context,
  ISurveyConfig,
  ItemSummary,
} from './ingv-config-survey.js';
import {Color} from '@cesium/engine';

// todo cors issue
// const prefix = 'https://testext-oracle.hes.scot/apex/hes';
const prefix = '/hes_api';

type HESTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type HESDefectResponse = {
  defect_id: number;
  event_id: number;
  event_type_code: string;
  event_type: string;
  hlf_defect_id: string;
  site_id: number;
  site_code: string;
  site_name: string;
  title: string;
  notes: string;
  defect_type_code: string;
  defect_type: string;
  section?: null;
  defect_status_code: string;
  defect_status: string;
  defect_priority_code: string;
  defect_priority: string;
  inspection_action_code: string;
  inspection_action: string;
  residual_risk_rating: number;
  fall_probability: 1 | 2 | 3 | 4 | 5;
  fall_consequence: 1 | 2 | 3 | 4 | 5;
  material_code: string;
  defect_material: string;
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
  defect_tags?: string; // todo should be replaced with string[]
};

type HESDefectItemSummary = ItemSummary & {
  identifiedRiskRating: string;
};

type HESDefectItem = ItemSummary & {
  hlfDefectId?: string;
  siteName: string;
  siteCode: string;
  reporter: string;
  dateRecorded: string;
  defectStatus: string;
  defectMaterial: string;
  defectTag: string;
  defectNotes?: string;
  fallProbability: string;
  fallConsequence: string;
  identifiedRiskRatingDescription: string;
  identifiedRiskRatingText: string;
  inspectionAction: string;
};

type HESDefectsResponse = {
  items: HESDefectResponse[];
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

type HESDefectTagResponse = {
  items: {
    material: string;
    material_code: string;
    defect_tags: {
      code: string;
      code_text: string;
    }[];
  }[];
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
    urlSP.delete('hes_secret');
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
  const response = await fetch(`${prefix}/oauth/token`, {
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
  const response = await fetch(`${prefix}${path}`, {
    method: 'GET',
    headers: myHeaders,
  });
  return <T>await response.json();
}

async function getHESSurveys(siteId: string): Promise<HESDefectItemSummary[]> {
  // FIXME: why do we limit the inspection type?
  // &inspection_type=evHLFInsp
  const result = await getFromHES<HESDefectsResponse>(
    `/picams-external/list_defects?site_code=${siteId}&limit=100000`,
  );
  const risks = await getFromHES<{
    items: {
      code: string;
      code_text: string;
      description: string;
    }[];
  }>('/picams-external/list_lkup?code_type=DEFECT_IDENTIFIED_RISK_RATING');
  return result['items']
    .filter(
      (s) => s.lat_degrees && s.long_degrees && s.elevation && s.updated_dt,
    )
    .map((s) => {
      const rating = String(s.fall_consequence * s.fall_probability);
      const riskInfo = risks.items.find((i) => i.code === rating);
      return {
        id: s.defect_id.toString(),
        // FIXME: flatten and convert to radians?
        coordinates: [s.long_degrees, s.lat_degrees, s.elevation],
        lastModifiedMs: new Date(s.updated_dt).getTime(),
        identifiedRiskRating: riskInfo.code_text,
      };
    });
}

async function getInspectionActions() {
  const result = await getFromHES<{
    items: {
      identified_risk_rating: string;
      identified_risk_rating_code: string;
      inspection_action: {
        code: string;
        code_text: string;
      }[];
    }[];
  }>(`/picams-external/inspection_action`);
  return Object.fromEntries(
    result.items.map((i) => [
      i.identified_risk_rating_code,
      i.inspection_action.map((a) => ({
        label: a.code_text,
        value: a.code,
      })),
    ]),
  );
}

async function getHESSurvey(defectId: string): Promise<HESDefectItem> {
  const result = await getFromHES<HESDefectsResponse>(
    `/picams-external/defect?defect_id=${defectId}`,
  );
  const s = result['items'][0];
  const identifiedRiskRating = String(s.fall_consequence * s.fall_probability);
  let defectTag = '';
  if (s.defect_tags?.length) {
    if (typeof s.defect_tags === 'string') {
      try {
        const defectTags: string[] = <string[]>JSON.parse(s.defect_tags);
        defectTag = defectTags[0];
      } catch (e) {
        console.error('Error during defect tags parse:', e);
      }
    } else if (Array.isArray(s.defect_tags)) {
      defectTag = s.defect_tags[0];
    }
  }
  const ratings = await getIdentifiedRiskRating();
  const rating = ratings.items.find((r) => r.code === identifiedRiskRating);
  return {
    id: s.defect_id.toString(),
    hlfDefectId: s.hlf_defect_id,
    siteName: s.site_name,
    siteCode: s.site_code,
    reporter: s.reporter,
    dateRecorded: s.date_recorded.replace('Z', ''),
    defectStatus: s.defect_status_code,
    defectMaterial: s.material_code,
    defectTag,
    defectNotes: s.notes,
    fallProbability: String(s.fall_probability),
    fallConsequence: String(s.fall_consequence),
    inspectionAction: s.inspection_action_code,
    identifiedRiskRatingDescription: `${rating.code_text}, ${rating.description}`,
    identifiedRiskRatingText: rating.code_text,
    // FIXME: flatten and convert to radians?
    coordinates: [s.long_degrees, s.lat_degrees, s.elevation],
    lastModifiedMs: new Date(s.updated_dt).getTime(),
  };
}

async function getHESFieldOptions(type: string) {
  const result = await getFromHES<{
    items: {
      code: string;
      code_text: string;
    }[];
  }>(`/picams-external/list_lkup?code_type=${type}`);
  return result.items.map((item) => ({
    label: item.code_text,
    value: item.code,
  }));
}

async function getIdentifiedRiskRating() {
  return await getFromHES<{
    items: {
      code: string;
      code_text: string;
      description?: string;
    }[];
  }>('/picams-external/list_lkup?code_type=DEFECT_IDENTIFIED_RISK_RATING');
}

async function getIdentifiedRiskRatingsDescription() {
  const result = await getIdentifiedRiskRating();
  return Object.fromEntries(
    result.items.map((i) => [i.code, `${i.code_text}, ${i.description}`]),
  );
}

async function getIdentifiedRiskRatingTexts() {
  const result = await getIdentifiedRiskRating();
  return Object.fromEntries(result.items.map((i) => [i.code, i.code_text]));
}

async function getHESDefectTags() {
  const res = await getFromHES<HESDefectTagResponse>(
    `/picams-external/defect_tag`,
  );
  return Object.fromEntries(
    res.items.map((i) => [
      i.material_code,
      i.defect_tags.map((item) => ({
        label: item.code_text,
        value: item.code,
      })),
    ]),
  );
}

function getRiskColor(identifiedRiskRating: string) {
  switch (identifiedRiskRating) {
    case 'Low':
      return '#008000';
    case 'Medium':
      return '#ffff00';
    case 'High':
      return '#ff0000';
    default:
      return '#808080';
  }
}

export const config: ISurveyConfig<ItemSummary, HESDefectItem> = {
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
      async getItem(context: Context) {
        // move function in this file
        return getHESSurvey(context?.id);
      },
      fieldsToItem(_: FieldValues) {
        throw new Error('not implemented');
      },
      itemToFields(item: HESDefectItem) {
        const c = item.coordinates;
        const values: FieldValues = {
          id: item.id,
          hlfDefectId: item.hlfDefectId,
          siteCode: item.siteCode,
          siteName: item.siteName,
          reporter: item.reporter,
          dateRecorded: item.dateRecorded,
          defectStatus: item.defectStatus,
          defectMaterial: item.defectMaterial,
          defectTag: item.defectTag,
          defectNotes: item.defectNotes,
          fallProbability: item.fallProbability,
          fallConsequence: item.fallConsequence,
          identifiedRiskRatingDescription: item.identifiedRiskRatingDescription,
          inspectionAction: item.inspectionAction,
          coordinates: {
            longitude: c[0],
            latitude: c[1],
            height: c[2],
          },
        };
        return values;
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
          label: 'Defect ID',
          type: 'id',
        },
        {
          id: 'hlfDefectId',
          label: 'HLF Defect ID',
          type: 'readonly',
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
          required: true,
        },
        {
          id: 'defectStatus',
          type: 'radio',
          label: 'Status',
          defaultValue: 'open',
          required: true,
          options: getHESFieldOptions.bind(undefined, 'DEFECT_STATUS'),
        },
        {
          id: 'defectMaterial',
          type: 'select',
          label: 'Defect material',
          required: true,
          options: getHESFieldOptions.bind(undefined, 'DEFECT_MATERIAL'),
        },
        {
          id: 'defectTag',
          type: 'select',
          label: 'Defect tag',
          required: true,
          options: getHESDefectTags.bind(undefined),
          keyPropId: 'defectMaterial',
        },
        {
          id: 'defectNotes',
          type: 'textarea',
          required: false,
          label: 'Description of defect',
          placeholder: 'Optional free text',
        },
        {
          id: 'fallProbability',
          type: 'select',
          label: 'Fall probability',
          required: true,
          options: [
            {
              label: 'Fabric fall highly unlikely',
              value: '1',
            },
            {
              label: 'Fabric fall unlikely',
              value: '2',
            },
            {
              label: 'Fabric fall likely',
              value: '3',
            },
            {
              label: 'Fabric fall highly likely',
              value: '4',
            },
            {
              label: 'Fabric fall almost certain',
              value: '5',
            },
          ],
        },
        {
          id: 'fallConsequence',
          type: 'select',
          label: 'Fall consequence',
          required: true,
          options: [
            {
              label: 'No injury',
              value: '1',
            },
            {
              label: 'Minor injury',
              value: '2',
            },
            {
              label: 'Moderate injury',
              value: '3',
            },
            {
              label: 'Major injury',
              value: '4',
            },
            {
              label: 'Fatal or life-altering injury',
              value: '5',
            },
          ],
        },
        {
          id: 'identifiedRiskRatingDescription',
          type: 'readonly',
          label: 'Identified risk rating',
          options: getIdentifiedRiskRatingsDescription.bind(undefined),
          keyCallback: (item: HESDefectItem): string => {
            const rating =
              Number(item.fallConsequence) * Number(item.fallProbability);
            return rating ? String(rating) : '';
          },
        },
        {
          id: 'identifiedRiskRatingText',
          type: 'readonly',
          hidden: true,
          options: getIdentifiedRiskRatingTexts.bind(undefined),
          keyCallback: (item: HESDefectItem): string => {
            const rating =
              Number(item.fallConsequence) * Number(item.fallProbability);
            return rating ? String(rating) : '';
          },
        },
        {
          id: 'identifiedRiskRatingColor',
          type: 'input',
          inputType: 'color',
          disabled: true,
          valueCallback: (item: FieldValues): string => {
            return getRiskColor(<string>item.identifiedRiskRatingText);
          },
        },
        {
          id: 'inspectionAction',
          type: 'select',
          label: 'Inspection action',
          required: true,
          options: getInspectionActions.bind(undefined),
          keyCallback: (item: FieldValues): string => {
            const rating =
              Number(item.fallConsequence) * Number(item.fallProbability);
            return rating ? String(rating) : '';
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
          id: 'PIC142',
          positions: [
            [-2.3755, 55.93941],
            [-2.37556, 55.93963],
            [-2.37498, 55.93968],
            [-2.37493, 55.93945],
          ],
          height: 17,
          elevation: 65,
          flyDuration: 2,
          title: 'Dunglass Collegiate Church',
          fovAngle: 45,
          tiles3d: ['@cesium/dunglass'],
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
      surveyOptions: {
        pointOptions: {
          colorCallback: (values: HESDefectItemSummary) =>
            Color.fromCssColorString(getRiskColor(values.identifiedRiskRating)),
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
