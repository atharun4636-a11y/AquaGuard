export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DrilldownLevel {
  id: 'india' | 'andhra-pradesh' | 'vijayawada' | 'wards' | 'site';
  label: string;
  center: GeoPoint;
  zoom: number;
  description: string;
}

export const GEO_DRILLDOWN_LEVELS: DrilldownLevel[] = [
  {
    id: 'india',
    label: 'India',
    center: { lat: 21.7679, lng: 78.8718 },
    zoom: 5,
    description: 'Country-level geographic context',
  },
  {
    id: 'andhra-pradesh',
    label: 'Andhra Pradesh',
    center: { lat: 15.9129, lng: 79.74 },
    zoom: 7,
    description: 'State-level coastal & Krishna basin view',
  },
  {
    id: 'vijayawada',
    label: 'Vijayawada',
    center: { lat: 16.5062, lng: 80.648 },
    zoom: 12,
    description: 'Vijayawada municipal urban overview',
  },
  {
    id: 'wards',
    label: 'Wards',
    center: { lat: 16.5085, lng: 80.642 },
    zoom: 14,
    description: 'Neighborhood & local area street view',
  },
  {
    id: 'site',
    label: 'Site View',
    center: { lat: 16.4971, lng: 80.6565 },
    zoom: 16,
    description: 'Street-level site inspection',
  },
];

/**
 * Real approximate WGS84 reference coordinates for Vijayawada localities.
 * Used strictly as point anchors on the real OpenStreetMap / CARTO basemap
 * for DEMO DATA overlays (not official ward boundary geometry).
 */
export const WARD_GEO_POINTS: Record<
  string,
  GeoPoint & { historicalCount: number; radiusMeters: number }
> = {
  'ward-bhavanipuram': {
    lat: 16.5205,
    lng: 80.5945,
    historicalCount: 9,
    radiusMeters: 620,
  },
  'ward-onetown': {
    lat: 16.5162,
    lng: 80.6145,
    historicalCount: 19,
    radiusMeters: 580,
  },
  'ward-singh-nagar': {
    lat: 16.5356,
    lng: 80.6406,
    historicalCount: 24,
    radiusMeters: 700,
  },
  'ward-governorpet': {
    lat: 16.5122,
    lng: 80.6317,
    historicalCount: 14,
    radiusMeters: 550,
  },
  'ward-gunadala': {
    lat: 16.5226,
    lng: 80.6642,
    historicalCount: 11,
    radiusMeters: 600,
  },
  'ward-mogalrajpuram': {
    lat: 16.5064,
    lng: 80.654,
    historicalCount: 8,
    radiusMeters: 520,
  },
  'ward-krishna-lanka': {
    lat: 16.4975,
    lng: 80.6295,
    historicalCount: 16,
    radiusMeters: 620,
  },
  'ward-benz-circle': {
    lat: 16.4971,
    lng: 80.6565,
    historicalCount: 22,
    radiusMeters: 560,
  },
  'ward-patamata': {
    lat: 16.4945,
    lng: 80.6762,
    historicalCount: 17,
    radiusMeters: 660,
  },
  'ward-kanuru': {
    lat: 16.4926,
    lng: 80.7034,
    historicalCount: 5,
    radiusMeters: 640,
  },
};

export const INCIDENT_GEO_POINTS: Record<string, GeoPoint> = {
  'INC-2026-104': { lat: 16.4979, lng: 80.6584 },
  'INC-2026-103': { lat: 16.5174, lng: 80.6129 },
  'INC-2026-102': { lat: 16.5371, lng: 80.6422 },
  'INC-2026-101': { lat: 16.4932, lng: 80.6788 },
  'INC-2026-099': { lat: 16.5114, lng: 80.6298 },
  'INC-2026-097': { lat: 16.5219, lng: 80.6665 },
};

export const DRAIN_GEO_POINTS: Record<string, GeoPoint> = {
  'DRN-01': { lat: 16.4963, lng: 80.6552 },
  'DRN-02': { lat: 16.5342, lng: 80.6388 },
  'DRN-03': { lat: 16.5151, lng: 80.6161 },
  'DRN-04': { lat: 16.4956, lng: 80.6746 },
  'DRN-05': { lat: 16.4958, lng: 80.6269 },
  'DRN-06': { lat: 16.5136, lng: 80.6334 },
  'DRN-07': { lat: 16.5238, lng: 80.6626 },
  'DRN-08': { lat: 16.4918, lng: 80.7019 },
};

export interface WaterwayLandmark {
  id: string;
  name: string;
  waterwayType: string;
  lat: number;
  lng: number;
  note: string;
}

export const WATERWAY_LANDMARKS: WaterwayLandmark[] = [
  {
    id: 'WW-BARRAGE',
    name: 'Prakasam Barrage (Krishna River)',
    waterwayType: 'River Barrage',
    lat: 16.5063,
    lng: 80.6054,
    note: 'Major Krishna River barrage regulating irrigation canal headworks.',
  },
  {
    id: 'WW-ELURU',
    name: 'Eluru Canal — Governorpet Stretch',
    waterwayType: 'Major Canal',
    lat: 16.5142,
    lng: 80.6338,
    note: 'Primary northeast canal corridor traversing central Vijayawada.',
  },
  {
    id: 'WW-RYVES',
    name: 'Ryves Canal — Mogalrajpuram Corridor',
    waterwayType: 'Major Canal',
    lat: 16.5082,
    lng: 80.6512,
    note: 'Central irrigation canal intersecting arterial stormwater cross-drains.',
  },
  {
    id: 'WW-BANDAR',
    name: 'Bandar Canal — Patamata / Benz Circle',
    waterwayType: 'Major Canal',
    lat: 16.4938,
    lng: 80.6628,
    note: 'Southern canal parallel to MG Road receiving stormwater outfalls.',
  },
  {
    id: 'WW-BUDAMERU',
    name: 'Budameru Drain — Ajit Singh Nagar',
    waterwayType: 'Urban Drain / Rivulet',
    lat: 16.5415,
    lng: 80.642,
    note: 'Northern floodway corridor critical during heavy depression spells.',
  },
];

export function resolveIncidentGeoPoint(
  incidentId: string,
  wardId: string,
  indexHint: number,
  explicitCoords?: { lat?: number; lng?: number }
): GeoPoint {
  if (
    typeof explicitCoords?.lat === 'number' &&
    typeof explicitCoords?.lng === 'number' &&
    !Number.isNaN(explicitCoords.lat) &&
    !Number.isNaN(explicitCoords.lng)
  ) {
    return { lat: explicitCoords.lat, lng: explicitCoords.lng };
  }
  if (INCIDENT_GEO_POINTS[incidentId]) {
    return INCIDENT_GEO_POINTS[incidentId];
  }
  const base = WARD_GEO_POINTS[wardId] ?? { lat: 16.5062, lng: 80.648 };
  const angle = ((indexHint * 137.5) % 360) * (Math.PI / 180);
  const offset = 0.0022;
  return {
    lat: Number((base.lat + Math.sin(angle) * offset).toFixed(5)),
    lng: Number((base.lng + Math.cos(angle) * offset).toFixed(5)),
  };
}

export function findNearestWardId(lat: number, lng: number): string {
  let bestId = 'ward-benz-circle';
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const [wardId, pt] of Object.entries(WARD_GEO_POINTS)) {
    const dLat = pt.lat - lat;
    const dLng = pt.lng - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestId = wardId;
    }
  }
  return bestId;
}

