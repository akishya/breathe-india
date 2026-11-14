export type PortalTab =
  | 'overview'
  | 'map'
  | 'compare'
  | 'cleaner'
  | 'dispersion3d'
  | 'explainer'
  | 'visuals'
  | 'health'
  | 'forecasts'
  | 'analytics';

export type AqiTier =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe';

export type TimeWindow = 'live' | '24h' | '7d' | '30d';
export type PollutantFocus = 'aqi' | 'pm25' | 'pm10' | 'no2' | 'so2' | 'co' | 'o3';
export type PortalLang = 'en' | 'hi';

export interface StationTelemetry {
  code: string;
  city: string;
  locality: string;
  stateCode: string;
  stateName: string;
  lat: number;
  lng: number;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  co: number; // mg/m³
  o3: number;
  windKmh: number;
  tempC: number;
  humidityPct: number;
  dominant: 'PM2.5' | 'PM10' | 'NO₂' | 'O₃';
  delta24h: number;
  hourlyPm25: number[]; // 9 points across 24h (00:00..23:59)
  hourlyPm10: number[];
  updatedMinutesAgo: number;
  source: 'live-telemetry' | 'cpcb-baseline';
}

export interface StateOption {
  code: string;
  label: string;
  labelHi: string;
}

export const INDIAN_STATES: StateOption[] = [
  { code: 'all', label: 'All India (National Grid)', labelHi: 'संपूर्ण भारत (राष्ट्रीय ग्रिड)' },
  { code: 'delhi', label: 'Delhi NCR', labelHi: 'दिल्ली एनसीआर' },
  { code: 'mh', label: 'Maharashtra', labelHi: 'महाराष्ट्र' },
  { code: 'ka', label: 'Karnataka', labelHi: 'कर्नाटक' },
  { code: 'mp', label: 'Madhya Pradesh', labelHi: 'मध्य प्रदेश' },
  { code: 'wb', label: 'West Bengal', labelHi: 'पश्चिम बंगाल' },
  { code: 'tn', label: 'Tamil Nadu', labelHi: 'तमिलनाडु' },
  { code: 'up', label: 'Uttar Pradesh', labelHi: 'उत्तर प्रदेश' },
  { code: 'br', label: 'Bihar', labelHi: 'बिहार' },
  { code: 'rj', label: 'Rajasthan', labelHi: 'राजस्थान' },
  { code: 'kl', label: 'Kerala', labelHi: 'केरल' },
  { code: 'sk', label: 'Sikkim & Northeast', labelHi: 'सिक्किम व पूर्वोत्तर' },
  { code: 'jk', label: 'Jammu & Kashmir', labelHi: 'जम्मू और कश्मीर' },
  { code: 'ap', label: 'Andhra Pradesh & Telangana', labelHi: 'आंध्र प्रदेश व तेलंगाना' },
];

export function getCpcbTier(aqi: number): AqiTier {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

export const AQI_TIER_RANK: Record<AqiTier, number> = {
  Good: 0,
  Satisfactory: 1,
  Moderate: 2,
  Poor: 3,
  'Very Poor': 4,
  Severe: 5,
};

export function isAqiCategoryWorse(prevAqi: number, nextAqi: number): boolean {
  return AQI_TIER_RANK[getCpcbTier(nextAqi)] > AQI_TIER_RANK[getCpcbTier(prevAqi)];
}

export function getTierColors(tier: AqiTier): {
  hex: string;
  badgeBg: string;
  badgeText: string;
  textClass: string;
  barClass: string;
  borderClass: string;
} {
  switch (tier) {
    case 'Good':
      return {
        hex: '#16A34A',
        badgeBg: 'bg-[#97f5cc]',
        badgeText: 'text-[#002115]',
        textClass: 'text-[#005d42]',
        barClass: 'bg-[#005d42]',
        borderClass: 'border-[#BBF7D0]',
      };
    case 'Satisfactory':
      return {
        hex: '#65A30D',
        badgeBg: 'bg-[#F7FEE7]',
        badgeText: 'text-[#365314]',
        textClass: 'text-[#047857]',
        barClass: 'bg-[#047857]',
        borderClass: 'border-[#D9F99D]',
      };
    case 'Moderate':
      return {
        hex: '#006398',
        badgeBg: 'bg-[#cce5ff]',
        badgeText: 'text-[#001d31]',
        textClass: 'text-[#006398]',
        barClass: 'bg-[#006398]',
        borderClass: 'border-[#93ccff]',
      };
    case 'Poor':
      return {
        hex: '#EA580C',
        badgeBg: 'bg-[#FFF7ED]',
        badgeText: 'text-[#9A3412]',
        textClass: 'text-[#EA580C]',
        barClass: 'bg-[#EA580C]',
        borderClass: 'border-[#FED7AA]',
      };
    case 'Very Poor':
      return {
        hex: '#ba1a1a',
        badgeBg: 'bg-[#ffdad6]',
        badgeText: 'text-[#93000a]',
        textClass: 'text-[#ba1a1a]',
        barClass: 'bg-[#ba1a1a]',
        borderClass: 'border-[#FECACA]',
      };
    case 'Severe':
      return {
        hex: '#7F1D1D',
        badgeBg: 'bg-[#7F1D1D]',
        badgeText: 'text-white',
        textClass: 'text-[#7F1D1D]',
        barClass: 'bg-[#7F1D1D]',
        borderClass: 'border-[#991B1B]',
      };
  }
}

/** Compute Indian CPCB National AQI (NAQI) from PM2.5 and PM10 concentrations */
export function computeIndiaAqi(pm25: number, pm10: number, no2 = 40, o3 = 38): number {
  const calcSub = (val: number, bps: [number, number, number, number][]): number => {
    for (const [cLow, cHigh, iLow, iHigh] of bps) {
      if (val <= cHigh) {
        return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (val - cLow) + iLow);
      }
    }
    return 450;
  };

  const pm25Sub = calcSub(pm25, [
    [0, 30, 0, 50],
    [30, 60, 51, 100],
    [60, 90, 101, 200],
    [90, 120, 201, 300],
    [120, 250, 301, 400],
    [250, 500, 401, 500],
  ]);

  const pm10Sub = calcSub(pm10, [
    [0, 50, 0, 50],
    [50, 100, 51, 100],
    [100, 250, 101, 200],
    [250, 350, 201, 300],
    [350, 430, 301, 400],
    [430, 800, 401, 500],
  ]);

  const no2Sub = calcSub(no2, [
    [0, 40, 0, 50],
    [40, 80, 51, 100],
    [80, 180, 101, 200],
    [180, 280, 201, 300],
    [280, 400, 301, 400],
    [400, 800, 401, 500],
  ]);

  const o3Sub = calcSub(o3, [
    [0, 50, 0, 50],
    [50, 100, 51, 100],
    [100, 168, 101, 200],
    [168, 208, 201, 300],
    [208, 748, 301, 400],
    [748, 1200, 401, 500],
  ]);

  return Math.max(12, Math.min(500, Math.max(pm25Sub, pm10Sub, no2Sub, o3Sub)));
}

export const BASELINE_INDIAN_STATIONS: StationTelemetry[] = [
  {
    code: 'DL-ANV-01',
    city: 'Delhi NCR',
    locality: 'Anand Vihar',
    stateCode: 'delhi',
    stateName: 'Delhi NCR',
    lat: 28.6468,
    lng: 77.3164,
    aqi: 342,
    pm25: 174.2,
    pm10: 312.0,
    no2: 82.4,
    so2: 18.6,
    co: 2.4,
    o3: 41.0,
    windKmh: 3.4,
    tempC: 17,
    humidityPct: 76,
    dominant: 'PM2.5',
    delta24h: 22,
    hourlyPm25: [148, 155, 196, 178, 122, 104, 142, 184, 174],
    hourlyPm10: [248, 260, 326, 298, 210, 182, 238, 315, 312],
    updatedMinutesAgo: 8,
    source: 'cpcb-baseline',
  },
  {
    code: 'BR-BEG-01',
    city: 'Begusarai',
    locality: 'Industrial Area',
    stateCode: 'br',
    stateName: 'Bihar',
    lat: 25.4182,
    lng: 86.1272,
    aqi: 328,
    pm25: 156.0,
    pm10: 278.5,
    no2: 64.2,
    so2: 24.0,
    co: 2.1,
    o3: 36.4,
    windKmh: 4.1,
    tempC: 19,
    humidityPct: 74,
    dominant: 'PM2.5',
    delta24h: 18,
    hourlyPm25: [130, 142, 172, 154, 106, 94, 128, 162, 156],
    hourlyPm10: [215, 232, 290, 264, 190, 174, 224, 282, 278],
    updatedMinutesAgo: 12,
    source: 'cpcb-baseline',
  },
  {
    code: 'RJ-BHW-03',
    city: 'Bhiwadi',
    locality: 'RIICO Phase III',
    stateCode: 'rj',
    stateName: 'Rajasthan',
    lat: 28.2099,
    lng: 76.8606,
    aqi: 316,
    pm25: 141.4,
    pm10: 348.2,
    no2: 58.0,
    so2: 21.5,
    co: 1.9,
    o3: 44.2,
    windKmh: 5.2,
    tempC: 20,
    humidityPct: 58,
    dominant: 'PM10',
    delta24h: 14,
    hourlyPm25: [118, 126, 158, 145, 98, 86, 118, 146, 141],
    hourlyPm10: [280, 295, 365, 338, 245, 220, 292, 354, 348],
    updatedMinutesAgo: 11,
    source: 'cpcb-baseline',
  },
  {
    code: 'MP-GWL-02',
    city: 'Gwalior',
    locality: 'City Centre',
    stateCode: 'mp',
    stateName: 'Madhya Pradesh',
    lat: 26.2183,
    lng: 78.1828,
    aqi: 284,
    pm25: 115.2,
    pm10: 242.0,
    no2: 52.0,
    so2: 14.8,
    co: 1.7,
    o3: 42.1,
    windKmh: 5.8,
    tempC: 21,
    humidityPct: 62,
    dominant: 'PM2.5',
    delta24h: 9,
    hourlyPm25: [96, 104, 134, 122, 84, 74, 98, 118, 115],
    hourlyPm10: [195, 210, 260, 244, 175, 160, 208, 246, 242],
    updatedMinutesAgo: 14,
    source: 'cpcb-baseline',
  },
  {
    code: 'UP-KNP-01',
    city: 'Kanpur',
    locality: 'Nehru Nagar',
    stateCode: 'up',
    stateName: 'Uttar Pradesh',
    lat: 26.4499,
    lng: 80.3319,
    aqi: 272,
    pm25: 111.5,
    pm10: 238.4,
    no2: 57.6,
    so2: 16.4,
    co: 1.8,
    o3: 39.5,
    windKmh: 4.5,
    tempC: 19,
    humidityPct: 71,
    dominant: 'PM10',
    delta24h: 11,
    hourlyPm25: [94, 102, 128, 116, 78, 68, 92, 114, 111],
    hourlyPm10: [188, 205, 255, 234, 168, 154, 198, 242, 238],
    updatedMinutesAgo: 10,
    source: 'cpcb-baseline',
  },
  {
    code: 'WB-VIC-01',
    city: 'Kolkata',
    locality: 'Victoria Memorial',
    stateCode: 'wb',
    stateName: 'West Bengal',
    lat: 22.5448,
    lng: 88.3426,
    aqi: 245,
    pm25: 103.8,
    pm10: 214.0,
    no2: 54.0,
    so2: 12.2,
    co: 1.6,
    o3: 36.0,
    windKmh: 6.4,
    tempC: 24,
    humidityPct: 75,
    dominant: 'PM2.5',
    delta24h: 6,
    hourlyPm25: [88, 95, 118, 108, 72, 65, 86, 106, 104],
    hourlyPm10: [176, 192, 232, 214, 152, 140, 182, 218, 214],
    updatedMinutesAgo: 11,
    source: 'cpcb-baseline',
  },
  {
    code: 'MH-BND-04',
    city: 'Mumbai',
    locality: 'Bandra Kurla Complex',
    stateCode: 'mh',
    stateName: 'Maharashtra',
    lat: 19.0653,
    lng: 72.8681,
    aqi: 142,
    pm25: 64.0,
    pm10: 128.5,
    no2: 41.0,
    so2: 11.4,
    co: 1.2,
    o3: 48.0,
    windKmh: 11.2,
    tempC: 28,
    humidityPct: 68,
    dominant: 'PM2.5',
    delta24h: -8,
    hourlyPm25: [54, 58, 76, 68, 46, 42, 56, 66, 64],
    hourlyPm10: [108, 116, 146, 134, 96, 88, 112, 132, 128],
    updatedMinutesAgo: 14,
    source: 'cpcb-baseline',
  },
  {
    code: 'MP-BPL-01',
    city: 'Bhopal',
    locality: 'T.T. Nagar',
    stateCode: 'mp',
    stateName: 'Madhya Pradesh',
    lat: 23.2313,
    lng: 77.3996,
    aqi: 118,
    pm25: 51.2,
    pm10: 116.4,
    no2: 34.5,
    so2: 9.8,
    co: 1.1,
    o3: 40.5,
    windKmh: 8.6,
    tempC: 24,
    humidityPct: 54,
    dominant: 'PM10',
    delta24h: -5,
    hourlyPm25: [42, 46, 62, 56, 38, 34, 44, 54, 51],
    hourlyPm10: [98, 106, 134, 122, 88, 82, 102, 120, 116],
    updatedMinutesAgo: 9,
    source: 'cpcb-baseline',
  },
  {
    code: 'TN-CHN-02',
    city: 'Chennai',
    locality: 'Alandur Bus Depot',
    stateCode: 'tn',
    stateName: 'Tamil Nadu',
    lat: 13.0012,
    lng: 80.2006,
    aqi: 82,
    pm25: 36.4,
    pm10: 78.0,
    no2: 28.4,
    so2: 8.5,
    co: 0.9,
    o3: 37.0,
    windKmh: 14.5,
    tempC: 29,
    humidityPct: 74,
    dominant: 'PM10',
    delta24h: -11,
    hourlyPm25: [30, 32, 44, 38, 26, 24, 32, 38, 36],
    hourlyPm10: [64, 70, 92, 82, 58, 54, 68, 80, 78],
    updatedMinutesAgo: 7,
    source: 'cpcb-baseline',
  },
  {
    code: 'KA-BTM-02',
    city: 'Bengaluru',
    locality: 'BTM Layout',
    stateCode: 'ka',
    stateName: 'Karnataka',
    lat: 12.9166,
    lng: 77.6101,
    aqi: 48,
    pm25: 18.2,
    pm10: 42.0,
    no2: 19.5,
    so2: 6.8,
    co: 0.7,
    o3: 31.2,
    windKmh: 12.4,
    tempC: 24,
    humidityPct: 62,
    dominant: 'PM2.5',
    delta24h: -6,
    hourlyPm25: [16, 18, 24, 20, 14, 12, 16, 19, 18],
    hourlyPm10: [36, 38, 50, 44, 32, 28, 36, 44, 42],
    updatedMinutesAgo: 8,
    source: 'cpcb-baseline',
  },
  {
    code: 'AP-TPT-01',
    city: 'Tirupati',
    locality: 'SV University Campus',
    stateCode: 'ap',
    stateName: 'Andhra Pradesh',
    lat: 13.6288,
    lng: 79.4192,
    aqi: 42,
    pm25: 16.4,
    pm10: 38.0,
    no2: 14.2,
    so2: 5.4,
    co: 0.6,
    o3: 28.0,
    windKmh: 13.0,
    tempC: 27,
    humidityPct: 64,
    dominant: 'PM10',
    delta24h: -4,
    hourlyPm25: [14, 15, 20, 18, 12, 11, 14, 17, 16],
    hourlyPm10: [32, 34, 44, 40, 28, 26, 34, 39, 38],
    updatedMinutesAgo: 9,
    source: 'cpcb-baseline',
  },
  {
    code: 'ML-SHL-01',
    city: 'Shillong',
    locality: 'Laban CAAQMS Node',
    stateCode: 'sk',
    stateName: 'Meghalaya',
    lat: 25.5788,
    lng: 91.8933,
    aqi: 38,
    pm25: 14.2,
    pm10: 31.5,
    no2: 11.4,
    so2: 4.5,
    co: 0.5,
    o3: 24.0,
    windKmh: 9.8,
    tempC: 16,
    humidityPct: 78,
    dominant: 'PM2.5',
    delta24h: -3,
    hourlyPm25: [12, 13, 18, 16, 11, 10, 13, 15, 14],
    hourlyPm10: [26, 28, 38, 34, 24, 22, 28, 32, 31],
    updatedMinutesAgo: 10,
    source: 'cpcb-baseline',
  },
  {
    code: 'JK-SGR-01',
    city: 'Srinagar',
    locality: 'Rajbagh Valley Node',
    stateCode: 'jk',
    stateName: 'Jammu & Kashmir',
    lat: 34.0837,
    lng: 74.7973,
    aqi: 35,
    pm25: 13.0,
    pm10: 29.0,
    no2: 12.0,
    so2: 4.2,
    co: 0.5,
    o3: 26.5,
    windKmh: 7.4,
    tempC: 11,
    humidityPct: 68,
    dominant: 'PM2.5',
    delta24h: -2,
    hourlyPm25: [11, 12, 16, 14, 10, 9, 12, 14, 13],
    hourlyPm10: [24, 26, 34, 30, 22, 20, 26, 30, 29],
    updatedMinutesAgo: 12,
    source: 'cpcb-baseline',
  },
  {
    code: 'KA-MYS-01',
    city: 'Mysuru',
    locality: 'Hebbal Industrial Base',
    stateCode: 'ka',
    stateName: 'Karnataka',
    lat: 12.2958,
    lng: 76.6394,
    aqi: 34,
    pm25: 12.6,
    pm10: 28.4,
    no2: 12.8,
    so2: 5.0,
    co: 0.5,
    o3: 25.0,
    windKmh: 11.4,
    tempC: 25,
    humidityPct: 60,
    dominant: 'PM10',
    delta24h: -5,
    hourlyPm25: [11, 12, 15, 14, 10, 9, 11, 13, 12],
    hourlyPm10: [24, 26, 33, 30, 22, 20, 25, 29, 28],
    updatedMinutesAgo: 8,
    source: 'cpcb-baseline',
  },
  {
    code: 'KA-CRG-01',
    city: 'Madikeri / Coorg',
    locality: 'Western Ghats High',
    stateCode: 'ka',
    stateName: 'Karnataka',
    lat: 12.4244,
    lng: 75.7382,
    aqi: 28,
    pm25: 10.2,
    pm10: 21.8,
    no2: 8.4,
    so2: 3.4,
    co: 0.4,
    o3: 22.0,
    windKmh: 12.8,
    tempC: 21,
    humidityPct: 79,
    dominant: 'PM2.5',
    delta24h: -2,
    hourlyPm25: [9, 10, 12, 11, 8, 7, 9, 11, 10],
    hourlyPm10: [18, 20, 25, 23, 16, 15, 19, 22, 22],
    updatedMinutesAgo: 7,
    source: 'cpcb-baseline',
  },
  {
    code: 'KL-MNR-01',
    city: 'Munnar',
    locality: 'Eravikulam Base',
    stateCode: 'kl',
    stateName: 'Kerala',
    lat: 10.0889,
    lng: 77.0595,
    aqi: 24,
    pm25: 8.0,
    pm10: 18.0,
    no2: 6.4,
    so2: 2.8,
    co: 0.3,
    o3: 19.5,
    windKmh: 13.6,
    tempC: 19,
    humidityPct: 81,
    dominant: 'PM2.5',
    delta24h: -3,
    hourlyPm25: [7, 8, 10, 9, 6, 6, 7, 9, 8],
    hourlyPm10: [15, 17, 21, 19, 14, 13, 16, 19, 18],
    updatedMinutesAgo: 6,
    source: 'cpcb-baseline',
  },
  {
    code: 'SK-GTK-01',
    city: 'Gangtok',
    locality: 'Deorali Ridge',
    stateCode: 'sk',
    stateName: 'Sikkim',
    lat: 27.3314,
    lng: 88.6138,
    aqi: 22,
    pm25: 7.4,
    pm10: 16.5,
    no2: 6.0,
    so2: 2.4,
    co: 0.3,
    o3: 18.0,
    windKmh: 10.4,
    tempC: 14,
    humidityPct: 76,
    dominant: 'PM2.5',
    delta24h: -2,
    hourlyPm25: [6, 7, 9, 8, 6, 5, 7, 8, 7],
    hourlyPm10: [14, 15, 19, 17, 13, 12, 15, 17, 16],
    updatedMinutesAgo: 5,
    source: 'cpcb-baseline',
  },
];

export interface ActiveAlertItem {
  id: string;
  city: string;
  state: string;
  aqi: number;
  tier: AqiTier;
  grapStage: string;
  advisory: string;
  advisoryHi: string;
}

export const NATIONAL_ALERTS: ActiveAlertItem[] = [
  {
    id: 'al-delhi',
    city: 'Delhi NCR (Anand Vihar)',
    state: 'Delhi',
    aqi: 342,
    tier: 'Very Poor',
    grapStage: 'GRAP Stage-III',
    advisory:
      'Stagnant morning inversion & nocturnal boundary trap. N95/FFP2 masks mandatory outdoors; halt outdoor school sports.',
    advisoryHi:
      'सुबह की स्थिर धुंध व रात्रि प्रदूषण जमाव। बाहर निकलते समय N95/FFP2 मास्क आवश्यक; बाहरी खेल गतिविधियां स्थगित करें।',
  },
  {
    id: 'al-begusarai',
    city: 'Begusarai',
    state: 'Bihar',
    aqi: 328,
    tier: 'Very Poor',
    grapStage: 'CPCB Red Advisory',
    advisory:
      'Industrial corridor PM2.5 elevated (>3x WHO safe tier). Sensitive groups stay indoors with HEPA filtration.',
    advisoryHi:
      'औद्योगिक क्षेत्र में PM2.5 स्तर अत्यधिक। संवेदनशील वर्ग घर के भीतर रहें व एयर प्यूरीफायर का उपयोग करें।',
  },
  {
    id: 'al-bhiwadi',
    city: 'Bhiwadi',
    state: 'Rajasthan',
    aqi: 316,
    tier: 'Very Poor',
    grapStage: 'GRAP Dust Control',
    advisory:
      'Coarse PM10 road & industrial dust suspension. Water sprinkling & construction cover enforcement active.',
    advisoryHi:
      'PM10 धूल कणों का उच्च स्तर। निर्माण स्थलों पर धूल नियंत्रण व जल छिड़काव निर्देश सक्रिय।',
  },
];
