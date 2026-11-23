import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DATASET_SOURCES,
  INITIAL_ACTIVITY,
  INITIAL_DEMO_USERS,
  INITIAL_DRAINS,
  INITIAL_INCIDENTS,
  INITIAL_TASKS,
  VIJAYAWADA_ZONES,
  WEATHER_ALERTS,
} from '../data/vijayawadaSeed';
import {
  ActivityItem,
  DatasetSource,
  DemoUser,
  DrainageAsset,
  DrainCondition,
  IncidentReport,
  IncidentStatus,
  MaintenanceStatus,
  MaintenanceTask,
  RiskLevel,
  RiskWeights,
  ScenarioType,
  UserRole,
  WardRiskZone,
  WeatherAlert,
} from '../types/aquaguard';
import {
  calculateLocationRiskScore,
  CityMetricsSummary,
  computeCityMetrics,
  computeDrainPriorityScore,
  DEFAULT_RISK_WEIGHTS,
} from '../utils/riskEngine';
import {
  canAccessNav,
  canConfigureSystem,
  canMutateOperationalData,
  formatWardScopeLabel,
  getOfficerAssignedWardIds,
  NavSectionId,
  validateWardAssignment,
} from '../utils/permissions';

export type { NavSectionId };

const STORAGE_KEY = 'aquaguard_vijayawada_demo_v1';

export interface CitizenMapDraft {
  wardId: string;
  lat: number;
  lng: number;
  suggestedLocation: string;
}

export interface WardAssignmentResponse {
  ok: boolean;
  error?: string;
  conflictOfficerName?: string;
}

interface PersistedState {
  currentUser: DemoUser | null;
  activeNav: NavSectionId;
  scenario: ScenarioType;
  customRainfallMmHr: number | undefined;
  weights: RiskWeights;
  incidents: IncidentReport[];
  drains: DrainageAsset[];
  tasks: MaintenanceTask[];
  users: DemoUser[];
  activities: ActivityItem[];
}

interface AquaGuardContextValue {
  currentUser: DemoUser | null;
  activeNav: NavSectionId;
  setActiveNav: (nav: NavSectionId) => void;
  loginAsRole: (role: UserRole, customUserId?: string) => void;
  logout: () => void;
  zones: WardRiskZone[];
  zoneAssessments: Record<string, ReturnType<typeof calculateLocationRiskScore>>;
  assignedWardIdsForCurrentOfficer: string[];
  scenario: ScenarioType;
  setScenario: (scenario: ScenarioType) => void;
  customRainfallMmHr: number | undefined;
  setCustomRainfallMmHr: (mm: number | undefined) => void;
  weights: RiskWeights;
  setWeights: (weights: RiskWeights) => void;
  resetWeights: () => void;
  incidents: IncidentReport[];
  drains: DrainageAsset[];
  tasks: MaintenanceTask[];
  alerts: WeatherAlert[];
  users: DemoUser[];
  datasets: DatasetSource[];
  activities: ActivityItem[];
  metrics: CityMetricsSummary;
  citizenMapDraft: CitizenMapDraft | null;
  setCitizenMapDraft: (draft: CitizenMapDraft | null) => void;
  submitCitizenIncident: (payload: {
    title: string;
    location: string;
    wardId: string;
    description: string;
    severity: RiskLevel;
    photoDataUrl?: string;
    photoName?: string;
    lat?: number;
    lng?: number;
  }) => IncidentReport;
  updateIncidentStatus: (
    incidentId: string,
    status: IncidentStatus,
    officerNotes?: string,
    assignedCrew?: string
  ) => { ok: boolean; error?: string };
  createMaintenanceTask: (payload: {
    title: string;
    assetId: string;
    assignedTeam: string;
    dueDate: string;
    notes: string;
    linkedIncidentId?: string;
  }) => { ok: boolean; error?: string };
  updateTaskStatus: (
    taskId: string,
    status: MaintenanceStatus
  ) => { ok: boolean; error?: string };
  updateDrainCondition: (
    assetId: string,
    condition: DrainCondition,
    blocked: boolean
  ) => { ok: boolean; error?: string };
  toggleUserActive: (userId: string) => void;
  addDemoUser: (payload: {
    name: string;
    email: string;
    role: UserRole;
    designation: string;
    wardScope: string;
    assignedWardIds?: string[];
  }) => { ok: boolean; error?: string };
  assignWardToOfficer: (
    officerId: string,
    wardId: string,
    options?: { allowReassign?: boolean; asAuthorizedBackup?: boolean }
  ) => WardAssignmentResponse;
  unassignWardFromOfficer: (
    officerId: string,
    wardId: string,
    isBackup?: boolean
  ) => void;
  resetAllDemoData: () => void;
}

const AquaGuardContext = createContext<AquaGuardContextValue | null>(null);

function nowTimestamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `2026-11-23 ${hh}:${mm}`;
}

function nowShortIst(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} IST`;
}

function hydrateUsers(storedUsers: DemoUser[] | undefined): DemoUser[] {
  if (!storedUsers || storedUsers.length === 0) return INITIAL_DEMO_USERS;
  return storedUsers.map((u) => {
    const seedMatch = INITIAL_DEMO_USERS.find((s) => s.id === u.id);
    if (u.role === UserRole.OFFICER) {
      const assignedWardIds =
        u.assignedWardIds ?? seedMatch?.assignedWardIds ?? [];
      const backupWardIds = u.backupWardIds ?? seedMatch?.backupWardIds ?? [];
      return {
        ...u,
        assignedWardIds,
        backupWardIds,
        wardScope:
          assignedWardIds.length > 0 || backupWardIds.length > 0
            ? formatWardScopeLabel(assignedWardIds, backupWardIds, VIJAYAWADA_ZONES)
            : u.wardScope || 'No wards assigned',
      };
    }
    return u;
  });
}

function hydrateIncidents(
  storedIncidents: IncidentReport[] | undefined
): IncidentReport[] {
  if (!storedIncidents || storedIncidents.length === 0) return INITIAL_INCIDENTS;
  return storedIncidents.map((inc) => {
    const seedMatch = INITIAL_INCIDENTS.find((s) => s.id === inc.id);
    return {
      ...inc,
      reporterId: inc.reporterId ?? seedMatch?.reporterId,
    };
  });
}

function loadInitialState(): PersistedState {
  const defaultState: PersistedState = {
    currentUser: null,
    activeNav: 'overview',
    scenario: ScenarioType.HEAVY,
    customRainfallMmHr: undefined,
    weights: DEFAULT_RISK_WEIGHTS,
    incidents: INITIAL_INCIDENTS,
    drains: INITIAL_DRAINS,
    tasks: INITIAL_TASKS,
    users: INITIAL_DEMO_USERS,
    activities: INITIAL_ACTIVITY,
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart');
    const roleParam = params.get('role')?.toUpperCase();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PersistedState>) : {};
    const users = hydrateUsers(parsed.users);
    const incidents = hydrateIncidents(parsed.incidents);

    let currentUser: DemoUser | null = null;
    if (parsed.currentUser) {
      currentUser =
        users.find((u) => u.id === parsed.currentUser?.id) ??
        parsed.currentUser;
    }

    let activeNav: NavSectionId = parsed.activeNav ?? 'overview';
    if (currentUser && !canAccessNav(currentUser.role, activeNav)) {
      activeNav = 'overview';
    }

    const merged: PersistedState = {
      ...defaultState,
      ...parsed,
      currentUser,
      activeNav,
      weights: parsed.weights ?? defaultState.weights,
      incidents,
      drains: parsed.drains ?? defaultState.drains,
      tasks: parsed.tasks ?? defaultState.tasks,
      users,
      activities: parsed.activities ?? defaultState.activities,
    };

    if (autostart === '1' && !merged.currentUser) {
      const targetRole =
        roleParam === UserRole.ADMIN ||
        roleParam === UserRole.OFFICER ||
        roleParam === UserRole.CITIZEN
          ? (roleParam as UserRole)
          : UserRole.OFFICER;
      merged.currentUser =
        merged.users.find((u) => u.role === targetRole && u.active) ??
        merged.users[0];
      merged.activeNav = 'overview';
    }
    return merged;
  } catch {
    return defaultState;
  }
}

export const AquaGuardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [citizenMapDraft, setCitizenMapDraft] = useState<CitizenMapDraft | null>(
    null
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors if large photo data URL is attached
    }
  }, [state]);

  // Keep active currentUser synchronized when Admin updates user ward assignments
  const resolvedCurrentUser = useMemo(() => {
    if (!state.currentUser) return null;
    return (
      state.users.find((u) => u.id === state.currentUser?.id) ?? state.currentUser
    );
  }, [state.currentUser, state.users]);

  const assignedWardIdsForCurrentOfficer = useMemo(
    () => getOfficerAssignedWardIds(resolvedCurrentUser),
    [resolvedCurrentUser]
  );

  const zoneAssessments = useMemo(() => {
    const map: Record<string, ReturnType<typeof calculateLocationRiskScore>> = {};
    for (const zone of VIJAYAWADA_ZONES) {
      map[zone.id] = calculateLocationRiskScore(
        zone,
        state.weights,
        state.scenario,
        state.customRainfallMmHr
      );
    }
    return map;
  }, [state.weights, state.scenario, state.customRainfallMmHr]);

  const metrics = useMemo(
    () =>
      computeCityMetrics(
        VIJAYAWADA_ZONES,
        state.incidents,
        state.drains,
        state.tasks,
        state.weights,
        state.scenario,
        state.customRainfallMmHr
      ),
    [
      state.incidents,
      state.drains,
      state.tasks,
      state.weights,
      state.scenario,
      state.customRainfallMmHr,
    ]
  );

  const setActiveNav = (nav: NavSectionId) => {
    setState((prev) => {
      const user = prev.currentUser;
      if (!user || !canAccessNav(user.role, nav)) {
        return { ...prev, activeNav: 'overview' };
      }
      return { ...prev, activeNav: nav };
    });
  };

  const loginAsRole = (role: UserRole, customUserId?: string) => {
    setCitizenMapDraft(null);
    setState((prev) => {
      const matched = customUserId
        ? prev.users.find((u) => u.id === customUserId && u.active)
        : prev.users.find((u) => u.role === role && u.active);
      const user =
        matched ?? prev.users.find((u) => u.role === role) ?? prev.users[0];
      return {
        ...prev,
        currentUser: user,
        activeNav: 'overview',
      };
    });
  };

  const logout = () => {
    setCitizenMapDraft(null);
    setState((prev) => ({ ...prev, currentUser: null, activeNav: 'overview' }));
  };

  const setScenario = (scenario: ScenarioType) => {
    setState((prev) => ({
      ...prev,
      scenario,
      customRainfallMmHr: undefined,
    }));
  };

  const setCustomRainfallMmHr = (mm: number | undefined) => {
    setState((prev) => ({ ...prev, customRainfallMmHr: mm }));
  };

  const setWeights = (weights: RiskWeights) => {
    if (!canConfigureSystem(resolvedCurrentUser)) return;
    setState((prev) => ({ ...prev, weights }));
  };

  const resetWeights = () => {
    if (!canConfigureSystem(resolvedCurrentUser)) return;
    setState((prev) => ({ ...prev, weights: DEFAULT_RISK_WEIGHTS }));
  };

  const submitCitizenIncident: AquaGuardContextValue['submitCitizenIncident'] = (
    payload
  ) => {
    const zone =
      VIJAYAWADA_ZONES.find((z) => z.id === payload.wardId) ?? VIJAYAWADA_ZONES[0];
    const jitterX = Math.round(((state.incidents.length * 17) % 26) - 13);
    const jitterY = Math.round(((state.incidents.length * 23) % 24) - 12);
    const newId = `INC-2026-${105 + state.incidents.length}`;
    const ts = nowTimestamp();
    const reporterName = resolvedCurrentUser?.name ?? 'Citizen User';
    const reporterRole = resolvedCurrentUser?.role ?? UserRole.CITIZEN;
    const newReport: IncidentReport = {
      id: newId,
      title: payload.title.trim(),
      location: payload.location.trim(),
      wardId: zone.id,
      wardName: zone.name,
      description: payload.description.trim(),
      severity: payload.severity,
      status: IncidentStatus.PENDING,
      reportedBy: `${reporterName} (${reporterRole === UserRole.CITIZEN ? 'Citizen' : 'Staff'})`,
      reporterId: resolvedCurrentUser?.id,
      reporterRole,
      createdAt: ts,
      updatedAt: ts,
      photoDataUrl: payload.photoDataUrl,
      photoName: payload.photoName,
      lat: payload.lat,
      lng: payload.lng,
      mapPoint: {
        x: Math.max(60, Math.min(940, zone.center.x + jitterX)),
        y: Math.max(60, Math.min(580, zone.center.y + jitterY)),
      },
    };

    const act: ActivityItem = {
      id: `ACT-${Date.now()}`,
      timestamp: nowShortIst(),
      actor: reporterName,
      role: reporterRole,
      action: `Submitted ${payload.severity} incident report at`,
      target: `${newReport.wardName} (${newReport.id})`,
    };

    setCitizenMapDraft(null);
    setState((prev) => ({
      ...prev,
      incidents: [newReport, ...prev.incidents],
      activities: [act, ...prev.activities].slice(0, 20),
    }));

    return newReport;
  };

  const updateIncidentStatus: AquaGuardContextValue['updateIncidentStatus'] = (
    incidentId,
    status,
    officerNotes,
    assignedCrew
  ) => {
    const targetInc = state.incidents.find((i) => i.id === incidentId);
    if (!targetInc) {
      return { ok: false, error: 'Incident record not found.' };
    }
    if (!canMutateOperationalData(resolvedCurrentUser, targetInc.wardId)) {
      return {
        ok: false,
        error: `Permission denied: You are not assigned to ${targetInc.wardName}.`,
      };
    }

    setState((prev) => {
      const updated = prev.incidents.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              status,
              updatedAt: nowTimestamp(),
              officerNotes: officerNotes !== undefined ? officerNotes : inc.officerNotes,
              assignedCrew: assignedCrew !== undefined ? assignedCrew : inc.assignedCrew,
            }
          : inc
      );

      const act: ActivityItem = {
        id: `ACT-${Date.now()}`,
        timestamp: nowShortIst(),
        actor: resolvedCurrentUser?.name ?? 'Municipal Officer',
        role: resolvedCurrentUser?.role ?? UserRole.OFFICER,
        action: `Updated ${incidentId} status to ${status} for`,
        target: targetInc.wardName,
      };

      return {
        ...prev,
        incidents: updated,
        activities: [act, ...prev.activities].slice(0, 20),
      };
    });

    return { ok: true };
  };

  const createMaintenanceTask: AquaGuardContextValue['createMaintenanceTask'] = (
    payload
  ) => {
    const asset =
      state.drains.find((d) => d.id === payload.assetId) ?? state.drains[0];
    if (!asset) {
      return { ok: false, error: 'Target drainage asset not found.' };
    }
    if (!canMutateOperationalData(resolvedCurrentUser, asset.wardId)) {
      return {
        ok: false,
        error: `Permission denied: ${asset.wardName} is outside your assigned ward jurisdiction.`,
      };
    }

    const zoneScore = zoneAssessments[asset.wardId]?.score ?? 65;
    const priorityScore = computeDrainPriorityScore(asset, zoneScore);
    const priority =
      priorityScore >= 76
        ? RiskLevel.CRITICAL
        : priorityScore >= 56
        ? RiskLevel.HIGH
        : priorityScore >= 34
        ? RiskLevel.MEDIUM
        : RiskLevel.LOW;

    const newTask: MaintenanceTask = {
      id: `TSK-${406 + state.tasks.length}`,
      title: payload.title.trim(),
      assetId: asset.id,
      assetName: asset.name,
      wardId: asset.wardId,
      wardName: asset.wardName,
      priority,
      priorityScore,
      status: MaintenanceStatus.PENDING,
      assignedTeam: payload.assignedTeam.trim(),
      dueDate: payload.dueDate,
      createdAt: nowTimestamp(),
      notes: payload.notes.trim(),
      linkedIncidentId: payload.linkedIncidentId,
    };

    const act: ActivityItem = {
      id: `ACT-${Date.now()}`,
      timestamp: nowShortIst(),
      actor: resolvedCurrentUser?.name ?? 'Municipal Officer',
      role: resolvedCurrentUser?.role ?? UserRole.OFFICER,
      action: `Assigned maintenance task ${newTask.id} (${newTask.assignedTeam}) for`,
      target: asset.name,
    };

    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
      incidents: payload.linkedIncidentId
        ? prev.incidents.map((inc) =>
            inc.id === payload.linkedIncidentId
              ? {
                  ...inc,
                  linkedTaskId: newTask.id,
                  status:
                    inc.status === IncidentStatus.PENDING
                      ? IncidentStatus.VERIFIED
                      : inc.status,
                  assignedCrew: newTask.assignedTeam,
                  updatedAt: nowTimestamp(),
                }
              : inc
          )
        : prev.incidents,
      activities: [act, ...prev.activities].slice(0, 20),
    }));

    return { ok: true };
  };

  const updateTaskStatus: AquaGuardContextValue['updateTaskStatus'] = (
    taskId,
    status
  ) => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Maintenance task not found.' };
    if (!canMutateOperationalData(resolvedCurrentUser, task.wardId)) {
      return {
        ok: false,
        error: `Permission denied: Cannot update tasks in ${task.wardName}.`,
      };
    }

    setState((prev) => {
      const updatedTasks = prev.tasks.map((t) =>
        t.id === taskId ? { ...t, status } : t
      );

      const updatedDrains =
        status === MaintenanceStatus.COMPLETED
          ? prev.drains.map((d) =>
              d.id === task.assetId
                ? {
                    ...d,
                    condition: DrainCondition.GOOD,
                    siltationPct: 18,
                    blockedReported: false,
                    lastMaintained: '2026-11-23',
                    capacityStatus: 'Cleared & restored (Demo)',
                  }
                : d
            )
          : prev.drains;

      const act: ActivityItem = {
        id: `ACT-${Date.now()}`,
        timestamp: nowShortIst(),
        actor: resolvedCurrentUser?.name ?? 'Municipal Officer',
        role: resolvedCurrentUser?.role ?? UserRole.OFFICER,
        action: `Marked ${taskId} as ${status} at`,
        target: task.wardName,
      };

      return {
        ...prev,
        tasks: updatedTasks,
        drains: updatedDrains,
        activities: [act, ...prev.activities].slice(0, 20),
      };
    });

    return { ok: true };
  };

  const updateDrainCondition: AquaGuardContextValue['updateDrainCondition'] = (
    assetId,
    condition,
    blocked
  ) => {
    const asset = state.drains.find((d) => d.id === assetId);
    if (!asset) return { ok: false, error: 'Drainage asset not found.' };
    if (!canMutateOperationalData(resolvedCurrentUser, asset.wardId)) {
      return {
        ok: false,
        error: `Permission denied: ${asset.wardName} is outside your assigned wards.`,
      };
    }

    setState((prev) => ({
      ...prev,
      drains: prev.drains.map((d) =>
        d.id === assetId
          ? {
              ...d,
              condition,
              blockedReported: blocked,
              siltationPct:
                condition === DrainCondition.GOOD
                  ? 15
                  : condition === DrainCondition.MODERATE
                  ? 48
                  : condition === DrainCondition.POOR
                  ? 74
                  : 88,
            }
          : d
      ),
    }));

    return { ok: true };
  };

  const toggleUserActive: AquaGuardContextValue['toggleUserActive'] = (userId) => {
    if (!canConfigureSystem(resolvedCurrentUser)) return;
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, active: !u.active } : u
      ),
    }));
  };

  const addDemoUser: AquaGuardContextValue['addDemoUser'] = (payload) => {
    if (!canConfigureSystem(resolvedCurrentUser)) {
      return { ok: false, error: 'Only Admin can create user accounts.' };
    }

    const requestedWards =
      payload.role === UserRole.OFFICER ? payload.assignedWardIds ?? [] : [];

    // Enforce duplicate-ward prevention even during initial officer provisioning
    for (const wId of requestedWards) {
      const owner = state.users.find(
        (u) =>
          u.role === UserRole.OFFICER &&
          (u.assignedWardIds ?? []).includes(wId)
      );
      if (owner) {
        const zone = VIJAYAWADA_ZONES.find((z) => z.id === wId);
        return {
          ok: false,
          error: `Ward ${zone?.wardNumber ?? wId} is already assigned to ${owner.name}. Unassign or use Officer Management to reassign.`,
        };
      }
    }

    const scopeLabel =
      payload.role === UserRole.OFFICER
        ? formatWardScopeLabel(requestedWards, [], VIJAYAWADA_ZONES)
        : payload.wardScope.trim();

    const newUser: DemoUser = {
      id: `USR-${payload.role.slice(0, 3)}-${Date.now().toString().slice(-4)}`,
      name: payload.name.trim(),
      email: payload.email.trim(),
      role: payload.role,
      designation: payload.designation.trim(),
      wardScope: scopeLabel,
      assignedWardIds: payload.role === UserRole.OFFICER ? requestedWards : undefined,
      backupWardIds: payload.role === UserRole.OFFICER ? [] : undefined,
      active: true,
      lastActive: 'Added just now',
    };

    const act: ActivityItem = {
      id: `ACT-${Date.now()}`,
      timestamp: nowShortIst(),
      actor: resolvedCurrentUser?.name ?? 'Admin',
      role: UserRole.ADMIN,
      action: `Provisioned ${payload.role} account`,
      target: `${newUser.name} (${scopeLabel})`,
    };

    setState((prev) => ({
      ...prev,
      users: [newUser, ...prev.users],
      activities: [act, ...prev.activities].slice(0, 20),
    }));

    return { ok: true };
  };

  const assignWardToOfficer: AquaGuardContextValue['assignWardToOfficer'] = (
    officerId,
    wardId,
    options
  ) => {
    if (!canConfigureSystem(resolvedCurrentUser)) {
      return { ok: false, error: 'Only Admin can manage officer ward assignments.' };
    }

    const check = validateWardAssignment(
      state.users,
      officerId,
      wardId,
      VIJAYAWADA_ZONES,
      options
    );
    if (!check.ok) {
      return {
        ok: false,
        error: check.error,
        conflictOfficerName: check.conflictOfficer?.name,
      };
    }

    const targetOfficer = state.users.find((u) => u.id === officerId)!;
    const zone = VIJAYAWADA_ZONES.find((z) => z.id === wardId)!;

    setState((prev) => {
      const nextUsers = prev.users.map((u) => {
        if (u.role !== UserRole.OFFICER) return u;

        let primary = [...(u.assignedWardIds ?? [])];
        let backup = [...(u.backupWardIds ?? [])];

        if (u.id === officerId) {
          if (options?.asAuthorizedBackup) {
            if (!backup.includes(wardId)) backup.push(wardId);
          } else {
            if (!primary.includes(wardId)) primary.push(wardId);
            backup = backup.filter((id) => id !== wardId);
          }
        } else if (options?.allowReassign && !options?.asAuthorizedBackup) {
          primary = primary.filter((id) => id !== wardId);
        }

        return {
          ...u,
          assignedWardIds: primary,
          backupWardIds: backup,
          wardScope: formatWardScopeLabel(primary, backup, VIJAYAWADA_ZONES),
        };
      });

      const actionLabel = options?.asAuthorizedBackup
        ? `Authorized backup assignment of Ward ${zone.wardNumber} to`
        : options?.allowReassign && check.conflictOfficer
        ? `Reassigned Ward ${zone.wardNumber} from ${check.conflictOfficer.name} to`
        : `Assigned Ward ${zone.wardNumber} to`;

      const act: ActivityItem = {
        id: `ACT-${Date.now()}`,
        timestamp: nowShortIst(),
        actor: resolvedCurrentUser?.name ?? 'Admin',
        role: UserRole.ADMIN,
        action: actionLabel,
        target: `${targetOfficer.name} (${zone.name})`,
      };

      return {
        ...prev,
        users: nextUsers,
        activities: [act, ...prev.activities].slice(0, 20),
      };
    });

    return { ok: true };
  };

  const unassignWardFromOfficer: AquaGuardContextValue['unassignWardFromOfficer'] = (
    officerId,
    wardId,
    isBackup = false
  ) => {
    if (!canConfigureSystem(resolvedCurrentUser)) return;
    const officer = state.users.find((u) => u.id === officerId);
    const zone = VIJAYAWADA_ZONES.find((z) => z.id === wardId);
    if (!officer || !zone) return;

    setState((prev) => {
      const nextUsers = prev.users.map((u) => {
        if (u.id !== officerId) return u;
        const primary = isBackup
          ? u.assignedWardIds ?? []
          : (u.assignedWardIds ?? []).filter((id) => id !== wardId);
        const backup = isBackup
          ? (u.backupWardIds ?? []).filter((id) => id !== wardId)
          : u.backupWardIds ?? [];

        return {
          ...u,
          assignedWardIds: primary,
          backupWardIds: backup,
          wardScope: formatWardScopeLabel(primary, backup, VIJAYAWADA_ZONES),
        };
      });

      const act: ActivityItem = {
        id: `ACT-${Date.now()}`,
        timestamp: nowShortIst(),
        actor: resolvedCurrentUser?.name ?? 'Admin',
        role: UserRole.ADMIN,
        action: `Unassigned ${isBackup ? 'backup ' : ''}Ward ${zone.wardNumber} from`,
        target: officer.name,
      };

      return {
        ...prev,
        users: nextUsers,
        activities: [act, ...prev.activities].slice(0, 20),
      };
    });
  };

  const resetAllDemoData = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setCitizenMapDraft(null);
    setState((prev) => ({
      currentUser: prev.currentUser
        ? INITIAL_DEMO_USERS.find((u) => u.id === prev.currentUser?.id) ??
          prev.currentUser
        : null,
      activeNav: 'overview',
      scenario: ScenarioType.HEAVY,
      customRainfallMmHr: undefined,
      weights: DEFAULT_RISK_WEIGHTS,
      incidents: INITIAL_INCIDENTS,
      drains: INITIAL_DRAINS,
      tasks: INITIAL_TASKS,
      users: INITIAL_DEMO_USERS,
      activities: INITIAL_ACTIVITY,
    }));
  };

  return (
    <AquaGuardContext.Provider
      value={{
        currentUser: resolvedCurrentUser,
        activeNav: state.activeNav,
        setActiveNav,
        loginAsRole,
        logout,
        zones: VIJAYAWADA_ZONES,
        zoneAssessments,
        assignedWardIdsForCurrentOfficer,
        scenario: state.scenario,
        setScenario,
        customRainfallMmHr: state.customRainfallMmHr,
        setCustomRainfallMmHr,
        weights: state.weights,
        setWeights,
        resetWeights,
        incidents: state.incidents,
        drains: state.drains,
        tasks: state.tasks,
        alerts: WEATHER_ALERTS,
        users: state.users,
        datasets: DATASET_SOURCES,
        activities: state.activities,
        metrics,
        citizenMapDraft,
        setCitizenMapDraft,
        submitCitizenIncident,
        updateIncidentStatus,
        createMaintenanceTask,
        updateTaskStatus,
        updateDrainCondition,
        toggleUserActive,
        addDemoUser,
        assignWardToOfficer,
        unassignWardFromOfficer,
        resetAllDemoData,
      }}
    >
      {children}
    </AquaGuardContext.Provider>
  );
};

export function useAquaGuard(): AquaGuardContextValue {
  const ctx = useContext(AquaGuardContext);
  if (!ctx) {
    throw new Error('useAquaGuard must be used within AquaGuardProvider');
  }
  return ctx;
}
