// todo cors issue

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type DefectItem = {
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

type DefectsResponse = {
  items: DefectItem[];
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

export async function getToken(url: string): Promise<string> {
  const myHeaders = new Headers();
  myHeaders.append('Content-Type', 'application/x-www-form-urlencoded');
  //todo do not push token
  myHeaders.append(
    'Authorization',
    'Basic ...', // todo add token
  );

  const urlencoded = new URLSearchParams();
  urlencoded.append('grant_type', 'client_credentials');

  //todo remove cors-anywhere host
  const response = await fetch(`http://localhost:8080/${url}/oauth/token`, {
    method: 'POST',
    headers: myHeaders,
    body: urlencoded,
  });
  const res: TokenResponse = <TokenResponse>await response.json();
  return res['access_token'];
}

export async function getSurveys(
  url: string,
  token: string,
  id: string,
): Promise<DefectsResponse> {
  const myHeaders = new Headers();
  myHeaders.append('Authorization', `Bearer ${token}`);

  //todo remove cors-anywhere host
  const response = await fetch(
    `http://localhost:8080/${url}/picams-external/list_defects?site_code=${id}&inspection_type=evHLFInsp`,
    {
      method: 'GET',
      headers: myHeaders,
    },
  );
  return <DefectsResponse>await response.json();
}
