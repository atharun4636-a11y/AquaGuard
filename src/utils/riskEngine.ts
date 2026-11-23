import {
  DrainageAsset,
  DrainCondition,
  IncidentReport,
  IncidentStatus,
  MaintenanceStatus,
  MaintenanceTask,
  RiskAssessmentResult,
  RiskLevel,
  RiskWeights,
  ScenarioType,
  WardRiskZone,
} from '../types/aquaguard';

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  rainfallIntensity: 30,
  historicalFrequency: 20,
  terrainElevation: 20,
  drainageCondition: 20,
  locationVulnerability: 10,
};

export interface ScenarioModifier {
  scenario: ScenarioType;
  label: string;
  rainfallMmHr: number;
  dailyAccumulationMm: number;
  rainfallMultiplier: number;
  drainStressBonus: number;
  description: string;
  advisory: string;
}

export function getScenarioModifiers(
  scenario: ScenarioType,
  customRainfallMmHr?: number
): ScenarioModifier {
  const baseMap: Record<ScenarioType, ScenarioModifier> = {
    [ScenarioType.NORMAL]: {
      scenario: ScenarioType.NORMAL,
      label: 'Normal Monsoon Shower',
      rainfallMmHr: 14,
      dailyAccumulationMm: 32,
      rainfallMultiplier: 0.72,
      drainStressBonus: 0,
      description: 'Steady light-to-moderate shower within routine stormwater conveyance capacity.',
      advisory: 'Routine drainage inspection in chronic low-lying underpasses.',
    },
    [ScenarioType.HEAVY]: {
      scenario: ScenarioType.HEAVY,
      label: 'Heavy Cloudburst Spell',
      rainfallMmHr: 42,
      dailyAccumulationMm: 108,
      rainfallMultiplier: 1.15,
      drainStressBonus: 12,
      description: 'Intense 2-hour spell exceeding older roadside culvert peak capacity.',
      advisory: 'Deploy mobile de-watering pumps at Benz Circle, Kothapet, and Gunadala underpasses.',
    },
    [ScenarioType.EXTREME]: {
      scenario: ScenarioType.EXTREME,
      label: 'Extreme Depression Event',
      rainfallMmHr: 78,
      dailyAccumulationMm: 215,
      rainfallMultiplier: 1.48,
      drainStressBonus: 24,
      description: 'Simulated severe cyclonic/depression rainfall with canal backwater surcharge.',
      advisory: 'Activate emergency ward control rooms, restrict low-lying underpass traffic, and issue public advisories.',
    },
  };

  const base = baseMap[scenario];
  if (typeof customRainfallMmHr === 'number' && !Number.isNaN(customRainfallMmHr)) {
    const clampedMm = Math.max(0, Math.min(120, customRainfallMmHr));
    const ratio = clampedMm / 40;
    const multiplier = Math.max(0.45, Math.min(1.65, 0.52 + ratio * 0.56));
    const drainStress = clampedMm > 50 ? Math.round((clampedMm - 40) * 0.5) : clampedMm > 25 ? 8 : 0;
    return {
      ...base,
      rainfallMmHr: clampedMm,
      dailyAccumulationMm: Math.round(clampedMm * 2.65),
      rainfallMultiplier: Number(multiplier.toFixed(2)),
      drainStressBonus: drainStress,
    };
  }
  return base;
}

export function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 76) return RiskLevel.CRITICAL;
  if (score >= 56) return RiskLevel.HIGH;
  if (score >= 34) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

export function normalizeWeights(weights: RiskWeights): RiskWeights {
  const sum =
    weights.rainfallIntensity +
    weights.historicalFrequency +
    weights.terrainElevation +
    weights.drainageCondition +
    weights.locationVulnerability;

  if (sum <= 0) return { ...DEFAULT_RISK_WEIGHTS };

  return {
    rainfallIntensity: (weights.rainfallIntensity / sum) * 100,
    historicalFrequency: (weights.historicalFrequency / sum) * 100,
    terrainElevation: (weights.terrainElevation / sum) * 100,
    drainageCondition: (weights.drainageCondition / sum) * 100,
    locationVulnerability: (weights.locationVulnerability / sum) * 100,
  };
}

export function calculateLocationRiskScore(
  zone: WardRiskZone,
  weights: RiskWeights = DEFAULT_RISK_WEIGHTS,
  scenario: ScenarioType = ScenarioType.HEAVY,
  customRainfallMmHr?: number
): RiskAssessmentResult {
  const norm = normalizeWeights(weights);
  const mod = getScenarioModifiers(scenario, customRainfallMmHr);

  const effectiveRainfall = Math.min(
    100,
    Math.round(zone.factors.baseRainfallExposure * mod.rainfallMultiplier)
  );
  const effectiveDrainage = Math.min(
    100,
    Math.round(zone.factors.drainageDeficit + mod.drainStressBonus)
  );

  const factorInputs: {
    key: keyof RiskWeights;
    label: string;
    rawValue: number;
    weightPct: number;
  }[] = [
    {
      key: 'rainfallIntensity',
      label: 'Rainfall Intensity',
      rawValue: effectiveRainfall,
      weightPct: Number(norm.rainfallIntensity.toFixed(1)),
    },
    {
      key: 'historicalFrequency',
      label: 'Historical Waterlogging Frequency',
      rawValue: zone.factors.historicalFrequency,
      weightPct: Number(norm.historicalFrequency.toFixed(1)),
    },
    {
      key: 'terrainElevation',
      label: 'Terrain & Elevation Profile',
      rawValue: zone.factors.terrainVulnerability,
      weightPct: Number(norm.terrainElevation.toFixed(1)),
    },
    {
      key: 'drainageCondition',
      label: 'Drainage Condition & Siltation',
      rawValue: effectiveDrainage,
      weightPct: Number(norm.drainageCondition.toFixed(1)),
    },
    {
      key: 'locationVulnerability',
      label: 'Location & Asset Vulnerability',
      rawValue: zone.factors.locationSensitivity,
      weightPct: Number(norm.locationVulnerability.toFixed(1)),
    },
  ];

  const factorBreakdown = factorInputs.map((item) => ({
    ...item,
    contribution: Number(((item.rawValue * item.weightPct) / 100).toFixed(1)),
  }));

  const rawTotal = factorBreakdown.reduce((acc, f) => acc + f.contribution, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawTotal)));
  const category = classifyRiskLevel(score);

  const sortedContributors = [...factorBreakdown].sort(
    (a, b) => b.rawValue - a.rawValue
  );

  const reasons: string[] = [];
  if (effectiveRainfall >= 68) {
    reasons.push(
      `Simulated ${mod.rainfallMmHr} mm/hr rainfall load places severe runoff pressure on local stormwater lines.`
    );
  } else if (effectiveRainfall >= 45) {
    reasons.push(
      `Moderate-to-high rainfall intensity (${mod.rainfallMmHr} mm/hr) raises surface accumulation rate.`
    );
  }
  if (zone.factors.terrainVulnerability >= 65) {
    reasons.push(`Terrain factor: ${zone.terrainNote}`);
  }
  if (effectiveDrainage >= 60) {
    reasons.push(`Drainage factor: ${zone.drainageNote}`);
  }
  if (zone.factors.historicalFrequency >= 65) {
    reasons.push(
      `Recurring monsoon hotspot with frequent past waterlogging logs around ${zone.landmark}.`
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      `Top contributing factor is ${sortedContributors[0].label} (${sortedContributors[0].rawValue}/100) within manageable threshold.`
    );
  }

  let recommendedAction = 'Continue routine ward monitoring and keep catch-pits clear.';
  if (category === RiskLevel.CRITICAL) {
    recommendedAction =
      'Immediate crew dispatch, pre-position mobile suction pumps, and restrict underpass movement.';
  } else if (category === RiskLevel.HIGH) {
    recommendedAction =
      'Prioritize pre-monsoon desilting, clear blocked inlets, and verify sump pump readiness.';
  } else if (category === RiskLevel.MEDIUM) {
    recommendedAction =
      'Schedule preventive culvert cleaning and inspect stormwater grates within 48 hours.';
  }

  return {
    score,
    category,
    factorBreakdown,
    reasons,
    recommendedAction,
  };
}

export function computeDrainPriorityScore(
  asset: DrainageAsset,
  zoneRiskScore: number
): number {
  const conditionWeight: Record<DrainCondition, number> = {
    [DrainCondition.GOOD]: 12,
    [DrainCondition.MODERATE]: 45,
    [DrainCondition.POOR]: 74,
    [DrainCondition.BLOCKED]: 95,
  };

  const blockedBonus = asset.blockedReported ? 14 : 0;
  const score =
    conditionWeight[asset.condition] * 0.48 +
    asset.siltationPct * 0.25 +
    zoneRiskScore * 0.27 +
    blockedBonus;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface CityMetricsSummary {
  averageRiskScore: number;
  criticalWardsCount: number;
  highWardsCount: number;
  mediumWardsCount: number;
  lowWardsCount: number;
  totalIncidents: number;
  pendingIncidents: number;
  resolvedIncidents: number;
  blockedDrainsCount: number;
  openTasksCount: number;
  completedTasksCount: number;
}

export function computeCityMetrics(
  zones: WardRiskZone[],
  incidents: IncidentReport[],
  drains: DrainageAsset[],
  tasks: MaintenanceTask[],
  weights: RiskWeights,
  scenario: ScenarioType,
  customRainfallMmHr?: number
): CityMetricsSummary {
  const assessments = zones.map((z) =>
    calculateLocationRiskScore(z, weights, scenario, customRainfallMmHr)
  );

  const avg =
    assessments.length > 0
      ? Math.round(
          assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length
        )
      : 0;

  return {
    averageRiskScore: avg,
    criticalWardsCount: assessments.filter((a) => a.category === RiskLevel.CRITICAL).length,
    highWardsCount: assessments.filter((a) => a.category === RiskLevel.HIGH).length,
    mediumWardsCount: assessments.filter((a) => a.category === RiskLevel.MEDIUM).length,
    lowWardsCount: assessments.filter((a) => a.category === RiskLevel.LOW).length,
    totalIncidents: incidents.length,
    pendingIncidents: incidents.filter(
      (i) =>
        i.status === IncidentStatus.PENDING ||
        i.status === IncidentStatus.VERIFIED ||
        i.status === IncidentStatus.IN_PROGRESS
    ).length,
    resolvedIncidents: incidents.filter(
      (i) => i.status === IncidentStatus.RESOLVED
    ).length,
    blockedDrainsCount: drains.filter(
      (d) => d.blockedReported || d.condition === DrainCondition.BLOCKED
    ).length,
    openTasksCount: tasks.filter((t) => t.status !== MaintenanceStatus.COMPLETED).length,
    completedTasksCount: tasks.filter((t) => t.status === MaintenanceStatus.COMPLETED).length,
  };
}

export interface IncidentFormInput {
  title: string;
  location: string;
  wardId: string;
  description: string;
}

export function validateIncidentInput(input: IncidentFormInput): {
  valid: boolean;
  errors: Partial<Record<keyof IncidentFormInput, string>>;
} {
  const errors: Partial<Record<keyof IncidentFormInput, string>> = {};
  if (!input.title.trim() || input.title.trim().length < 4) {
    errors.title = 'Please provide a brief incident title (at least 4 characters).';
  }
  if (!input.location.trim() || input.location.trim().length < 3) {
    errors.location = 'Please specify the street, junction, or landmark.';
  }
  if (!input.wardId.trim()) {
    errors.wardId = 'Please select a Vijayawada ward or zone.';
  }
  if (!input.description.trim() || input.description.trim().length < 10) {
    errors.description = 'Please describe water depth or blockage conditions (at least 10 characters).';
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
