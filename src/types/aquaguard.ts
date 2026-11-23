export enum UserRole {
  ADMIN = 'ADMIN',
  OFFICER = 'OFFICER',
  CITIZEN = 'CITIZEN',
}

export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

export enum IncidentStatus {
  PENDING = 'Pending Review',
  VERIFIED = 'Verified',
  IN_PROGRESS = 'Crew Dispatched',
  RESOLVED = 'Resolved',
  DISMISSED = 'Duplicate / Closed',
}

export enum ScenarioType {
  NORMAL = 'Normal',
  HEAVY = 'Heavy',
  EXTREME = 'Extreme',
}

export enum MaintenanceStatus {
  PENDING = 'Pending',
  SCHEDULED = 'Scheduled',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
}

export enum DrainCondition {
  GOOD = 'Good',
  MODERATE = 'Moderate Siltation',
  POOR = 'Heavily Silted',
  BLOCKED = 'Blocked',
}

export interface RiskWeights {
  rainfallIntensity: number;
  historicalFrequency: number;
  terrainElevation: number;
  drainageCondition: number;
  locationVulnerability: number;
}

export interface WardRiskZone {
  id: string;
  wardNumber: number;
  name: string;
  landmark: string;
  /** Schematic SVG polygon points in 1000x660 Vijayawada canvas */
  svgPolygon: string;
  /** Schematic centroid coordinates for pin & label placement */
  center: { x: number; y: number };
  /** Illustrative display coordinates (non-survey demo reference) */
  demoCoords: string;
  /** Factor inputs on 0–100 scale for transparent demo scoring */
  factors: {
    baseRainfallExposure: number;
    historicalFrequency: number;
    terrainVulnerability: number;
    drainageDeficit: number;
    locationSensitivity: number;
  };
  terrainNote: string;
  drainageNote: string;
  populationExposedLabel: string;
}

export interface RiskAssessmentResult {
  score: number;
  category: RiskLevel;
  factorBreakdown: {
    label: string;
    key: keyof RiskWeights;
    rawValue: number;
    weightPct: number;
    contribution: number;
  }[];
  reasons: string[];
  recommendedAction: string;
}

export interface IncidentReport {
  id: string;
  title: string;
  location: string;
  wardId: string;
  wardName: string;
  description: string;
  severity: RiskLevel;
  status: IncidentStatus;
  reportedBy: string;
  reporterId?: string;
  reporterRole: UserRole;
  createdAt: string;
  updatedAt: string;
  assignedCrew?: string;
  officerNotes?: string;
  photoDataUrl?: string;
  photoName?: string;
  /** Schematic position on the 1000x660 SVG map */
  mapPoint: { x: number; y: number };
  /** Optional real WGS84 coordinates when selected directly on the GIS map */
  lat?: number;
  lng?: number;
  linkedTaskId?: string;
}

export interface DrainageAsset {
  id: string;
  assetCode: string;
  name: string;
  wardId: string;
  wardName: string;
  corridorType: 'Stormwater Trunk' | 'Canal Outfall' | 'Roadside Culvert' | 'Underpass Sump';
  condition: DrainCondition;
  siltationPct: number;
  lastMaintained: string;
  blockedReported: boolean;
  capacityStatus: string;
  mapPoint: { x: number; y: number };
}

export interface MaintenanceTask {
  id: string;
  title: string;
  assetId: string;
  assetName: string;
  wardId: string;
  wardName: string;
  priority: RiskLevel;
  priorityScore: number;
  status: MaintenanceStatus;
  assignedTeam: string;
  dueDate: string;
  createdAt: string;
  notes: string;
  linkedIncidentId?: string;
}

export interface RainfallStationPoint {
  label: string;
  rainfallMm: number;
  intensityMmHr: number;
  thresholdMm: number;
}

export interface WeatherAlert {
  id: string;
  title: string;
  severity: RiskLevel;
  issuedAt: string;
  validUntil: string;
  affectedWards: string[];
  summary: string;
  advisory: string;
  sourceLabel: string;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation: string;
  wardScope: string;
  assignedWardIds?: string[];
  backupWardIds?: string[];
  active: boolean;
  lastActive: string;
}

export interface DatasetSource {
  id: string;
  name: string;
  category: string;
  nature: 'Illustrative Demo Data' | 'Simulated Scenario Model' | 'Sample Historical Log';
  updateCadence: string;
  coverage: string;
  notes: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: string;
  target: string;
}
