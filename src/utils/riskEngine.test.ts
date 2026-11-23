import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLocationRiskScore,
  classifyRiskLevel,
  computeCityMetrics,
  computeDrainPriorityScore,
  DEFAULT_RISK_WEIGHTS,
  getScenarioModifiers,
  normalizeWeights,
  validateIncidentInput,
} from './riskEngine';
import {
  DrainageAsset,
  DrainCondition,
  IncidentReport,
  IncidentStatus,
  MaintenanceStatus,
  MaintenanceTask,
  RiskLevel,
  ScenarioType,
  UserRole,
  WardRiskZone,
} from '../types/aquaguard';

const sampleZone: WardRiskZone = {
  id: 'ward-patamata',
  wardNumber: 12,
  name: 'Patamata & Autonagar',
  landmark: 'Autonagar Gate & Bandar Canal Bank',
  svgPolygon: '0,0 10,0 10,10',
  center: { x: 600, y: 350 },
  demoCoords: '16.4970° N, 80.6680° E (Demo)',
  factors: {
    baseRainfallExposure: 65,
    historicalFrequency: 72,
    terrainVulnerability: 68,
    drainageDeficit: 70,
    locationSensitivity: 60,
  },
  terrainNote: 'Flat alluvial basin near Bandar Canal',
  drainageNote: 'High silt load from industrial workshops',
  populationExposedLabel: '~48,000 residents',
};

test('classifyRiskLevel maps score thresholds deterministically', () => {
  assert.equal(classifyRiskLevel(20), RiskLevel.LOW);
  assert.equal(classifyRiskLevel(34), RiskLevel.MEDIUM);
  assert.equal(classifyRiskLevel(56), RiskLevel.HIGH);
  assert.equal(classifyRiskLevel(76), RiskLevel.CRITICAL);
});

test('normalizeWeights handles arbitrary positive sums and zero fallback', () => {
  const normalized = normalizeWeights({
    rainfallIntensity: 60,
    historicalFrequency: 40,
    terrainElevation: 40,
    drainageCondition: 40,
    locationVulnerability: 20,
  });
  const total =
    normalized.rainfallIntensity +
    normalized.historicalFrequency +
    normalized.terrainElevation +
    normalized.drainageCondition +
    normalized.locationVulnerability;
  assert.equal(Math.round(total), 100);
  assert.equal(normalized.rainfallIntensity, 30);

  const fallback = normalizeWeights({
    rainfallIntensity: 0,
    historicalFrequency: 0,
    terrainElevation: 0,
    drainageCondition: 0,
    locationVulnerability: 0,
  });
  assert.deepEqual(fallback, DEFAULT_RISK_WEIGHTS);
});

test('scenario escalation strictly increases location risk score from Normal to Extreme', () => {
  const normal = calculateLocationRiskScore(
    sampleZone,
    DEFAULT_RISK_WEIGHTS,
    ScenarioType.NORMAL
  );
  const heavy = calculateLocationRiskScore(
    sampleZone,
    DEFAULT_RISK_WEIGHTS,
    ScenarioType.HEAVY
  );
  const extreme = calculateLocationRiskScore(
    sampleZone,
    DEFAULT_RISK_WEIGHTS,
    ScenarioType.EXTREME
  );

  assert.ok(normal.score < heavy.score, 'Heavy should score higher than Normal');
  assert.ok(heavy.score < extreme.score, 'Extreme should score higher than Heavy');
  assert.equal(extreme.category, RiskLevel.CRITICAL);
  assert.equal(normal.factorBreakdown.length, 5);
});

test('getScenarioModifiers supports custom rainfall override clamping', () => {
  const custom = getScenarioModifiers(ScenarioType.HEAVY, 95);
  assert.equal(custom.rainfallMmHr, 95);
  assert.ok(custom.rainfallMultiplier > 1.4);

  const clamped = getScenarioModifiers(ScenarioType.NORMAL, 999);
  assert.equal(clamped.rainfallMmHr, 120);
});

test('computeDrainPriorityScore prioritizes blocked drains in high-risk zones', () => {
  const blockedAsset: DrainageAsset = {
    id: 'drain-1',
    assetCode: 'DRN-101',
    name: 'Autonagar Main Culvert',
    wardId: 'ward-patamata',
    wardName: 'Patamata & Autonagar',
    corridorType: 'Roadside Culvert',
    condition: DrainCondition.BLOCKED,
    siltationPct: 88,
    lastMaintained: '2026-08-14',
    blockedReported: true,
    capacityStatus: 'Restricted flow',
    mapPoint: { x: 610, y: 360 },
  };
  const goodAsset: DrainageAsset = {
    ...blockedAsset,
    id: 'drain-2',
    condition: DrainCondition.GOOD,
    siltationPct: 12,
    blockedReported: false,
  };

  const blockedScore = computeDrainPriorityScore(blockedAsset, 82);
  const goodScore = computeDrainPriorityScore(goodAsset, 82);
  assert.ok(blockedScore > 85);
  assert.ok(blockedScore > goodScore + 40);
});

test('computeCityMetrics aggregates incidents and maintenance tasks accurately', () => {
  const incidents: IncidentReport[] = [
    {
      id: 'INC-1',
      title: 'Submerged service road',
      location: 'Benz Circle',
      wardId: 'ward-patamata',
      wardName: 'Patamata & Autonagar',
      description: 'Knee-deep stagnation blocking traffic lane.',
      severity: RiskLevel.HIGH,
      status: IncidentStatus.PENDING,
      reportedBy: 'Ramesh K.',
      reporterRole: UserRole.CITIZEN,
      createdAt: '2026-11-22 09:30',
      updatedAt: '2026-11-22 09:30',
      mapPoint: { x: 500, y: 300 },
    },
    {
      id: 'INC-2',
      title: 'Cleared culvert',
      location: 'MG Road',
      wardId: 'ward-patamata',
      wardName: 'Patamata & Autonagar',
      description: 'Water drained after crew desilting.',
      severity: RiskLevel.MEDIUM,
      status: IncidentStatus.RESOLVED,
      reportedBy: 'Lakshmi P.',
      reporterRole: UserRole.CITIZEN,
      createdAt: '2026-11-21 15:00',
      updatedAt: '2026-11-22 08:00',
      mapPoint: { x: 510, y: 310 },
    },
  ];
  const tasks: MaintenanceTask[] = [
    {
      id: 'TSK-1',
      title: 'Jetting at Autonagar',
      assetId: 'drain-1',
      assetName: 'Autonagar Main Culvert',
      wardId: 'ward-patamata',
      wardName: 'Patamata & Autonagar',
      priority: RiskLevel.CRITICAL,
      priorityScore: 92,
      status: MaintenanceStatus.IN_PROGRESS,
      assignedTeam: 'Zone-3 Rapid Desilting Unit',
      dueDate: '2026-11-24',
      createdAt: '2026-11-22',
      notes: 'Pump deployed',
    },
  ];

  const metrics = computeCityMetrics(
    [sampleZone],
    incidents,
    [],
    tasks,
    DEFAULT_RISK_WEIGHTS,
    ScenarioType.HEAVY
  );

  assert.equal(metrics.totalIncidents, 2);
  assert.equal(metrics.pendingIncidents, 1);
  assert.equal(metrics.resolvedIncidents, 1);
  assert.equal(metrics.openTasksCount, 1);
  assert.equal(metrics.completedTasksCount, 0);
});

test('validateIncidentInput rejects incomplete fields and accepts valid input', () => {
  const invalid = validateIncidentInput({
    title: 'Hi',
    location: '',
    wardId: '',
    description: 'short',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.title);
  assert.ok(invalid.errors.location);
  assert.ok(invalid.errors.wardId);
  assert.ok(invalid.errors.description);

  const valid = validateIncidentInput({
    title: 'Underpass water stagnation',
    location: 'Benz Circle Underpass East',
    wardId: 'ward-benz-circle',
    description: 'Stormwater grate appears clogged with debris causing 1.5 ft waterlogging.',
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

import {
  canAccessNav,
  canMutateOperationalData,
  canUserAccessWard,
  computeOfficerPerformance,
  getUnassignedWards,
  sanitizeIncidentForCitizenMap,
  validateWardAssignment,
} from './permissions';
import { INITIAL_DEMO_USERS, INITIAL_DRAINS, INITIAL_INCIDENTS, INITIAL_TASKS, VIJAYAWADA_ZONES } from '../data/vijayawadaSeed';

test('canAccessNav enforces strict role boundaries across Admin, Officer, and Citizen', () => {
  assert.equal(canAccessNav(UserRole.ADMIN, 'officers'), true);
  assert.equal(canAccessNav(UserRole.ADMIN, 'datasets'), true);
  assert.equal(canAccessNav(UserRole.ADMIN, 'report-incident'), false);

  assert.equal(canAccessNav(UserRole.OFFICER, 'incidents'), true);
  assert.equal(canAccessNav(UserRole.OFFICER, 'officers'), false);
  assert.equal(canAccessNav(UserRole.OFFICER, 'users'), false);
  assert.equal(canAccessNav(UserRole.OFFICER, 'datasets'), false);

  assert.equal(canAccessNav(UserRole.CITIZEN, 'report-incident'), true);
  assert.equal(canAccessNav(UserRole.CITIZEN, 'gis-map'), true);
  assert.equal(canAccessNav(UserRole.CITIZEN, 'drainage'), false);
  assert.equal(canAccessNav(UserRole.CITIZEN, 'officers'), false);
  assert.equal(canAccessNav(UserRole.CITIZEN, 'incidents'), false);
});

test('officer ward isolation prevents accessing or mutating another officer ward', () => {
  const admin = INITIAL_DEMO_USERS.find((u) => u.role === UserRole.ADMIN)!;
  const officer1 = INITIAL_DEMO_USERS.find((u) => u.id === 'USR-OFC-01')!;
  const officer2 = INITIAL_DEMO_USERS.find((u) => u.id === 'USR-OFC-02')!;
  const citizen = INITIAL_DEMO_USERS.find((u) => u.role === UserRole.CITIZEN)!;

  assert.equal(canUserAccessWard(officer1, 'ward-benz-circle'), true);
  assert.equal(canUserAccessWard(officer1, 'ward-singh-nagar'), false);
  assert.equal(canUserAccessWard(officer2, 'ward-singh-nagar'), true);
  assert.equal(canUserAccessWard(officer2, 'ward-benz-circle'), false);

  assert.equal(canMutateOperationalData(officer1, 'ward-benz-circle'), true);
  assert.equal(canMutateOperationalData(officer1, 'ward-singh-nagar'), false);
  assert.equal(canMutateOperationalData(admin, 'ward-singh-nagar'), true);
  assert.equal(canMutateOperationalData(citizen, 'ward-benz-circle'), false);
});

test('validateWardAssignment blocks duplicate ordinary wards unless reassigned or authorized backup', () => {
  // Benz Circle is assigned to USR-OFC-01; attempting ordinary assignment to USR-OFC-02 must fail
  const blocked = validateWardAssignment(
    INITIAL_DEMO_USERS,
    'USR-OFC-02',
    'ward-benz-circle',
    VIJAYAWADA_ZONES
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.conflictOfficer?.id, 'USR-OFC-01');
  assert.match(blocked.error ?? '', /already assigned/i);

  // Explicit reassign must succeed
  const reassign = validateWardAssignment(
    INITIAL_DEMO_USERS,
    'USR-OFC-02',
    'ward-benz-circle',
    VIJAYAWADA_ZONES,
    { allowReassign: true }
  );
  assert.equal(reassign.ok, true);

  // Explicit authorized backup must succeed
  const backup = validateWardAssignment(
    INITIAL_DEMO_USERS,
    'USR-OFC-02',
    'ward-benz-circle',
    VIJAYAWADA_ZONES,
    { asAuthorizedBackup: true }
  );
  assert.equal(backup.ok, true);

  // Unassigned ward can be assigned directly without conflict
  const unassigned = getUnassignedWards(INITIAL_DEMO_USERS, VIJAYAWADA_ZONES);
  assert.equal(unassigned.length, 2);
  const freeAssign = validateWardAssignment(
    INITIAL_DEMO_USERS,
    'USR-OFC-01',
    unassigned[0].id,
    VIJAYAWADA_ZONES
  );
  assert.equal(freeAssign.ok, true);
});

test('sanitizeIncidentForCitizenMap strips private citizen and internal municipal fields', () => {
  const sanitized = sanitizeIncidentForCitizenMap(INITIAL_INCIDENTS[0]);
  assert.equal(sanitized.id, 'INC-2026-104');
  assert.equal(sanitized.publicStatusLabel, 'Response Active');
  assert.equal('reportedBy' in sanitized, false);
  assert.equal('reporterId' in sanitized, false);
  assert.equal('assignedCrew' in sanitized, false);
  assert.equal('officerNotes' in sanitized, false);
});

test('computeOfficerPerformance scopes incidents, drains, and tasks strictly to officer wards', () => {
  const officer1 = INITIAL_DEMO_USERS.find((u) => u.id === 'USR-OFC-01')!;
  const officer2 = INITIAL_DEMO_USERS.find((u) => u.id === 'USR-OFC-02')!;

  const perf1 = computeOfficerPerformance(
    officer1,
    INITIAL_INCIDENTS,
    INITIAL_DRAINS,
    INITIAL_TASKS
  );
  const perf2 = computeOfficerPerformance(
    officer2,
    INITIAL_INCIDENTS,
    INITIAL_DRAINS,
    INITIAL_TASKS
  );

  assert.equal(perf1.primaryWardCount, 4);
  assert.equal(perf1.totalIncidents, 3); // Benz Circle, Patamata, Gunadala
  assert.equal(perf2.primaryWardCount, 4);
  assert.equal(perf2.totalIncidents, 3); // One Town, Singh Nagar, Governorpet
});

