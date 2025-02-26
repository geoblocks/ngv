// todo cors issue

import type {Item, ItemSummary} from './ingv-config-survey.js';

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
  return sk;
}

const hesSecretKey = getHESSecretKey();
let bearerCache = {
  expire_ms: 0,
  token: '',
};

export async function getHESBearerToken(): Promise<string> {
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

export async function getHESSurveys(siteId: string): Promise<ItemSummary[]> {
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

export async function getHESSurvey(defectId: string): Promise<Item> {
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
