import {
  DemoUser,
  DrainageAsset,
  DrainCondition,
  IncidentReport,
  IncidentStatus,
  MaintenanceStatus,
  MaintenanceTask,
  UserRole,
  WardRiskZone,
} from '../types/aquaguard';

export type NavSectionId =
  | 'overview'
  | 'gis-map'
  | 'rainfall'
  | 'ai-risk'
  | 'simulator'
  | 'drainage'
  | 'incidents'
  | 'analytics'
  | 'officers'
  | 'users'
  | 'datasets'
  | 'report-incident'
  | 'my-complaints'
  | 'public-alerts';

export const ROLE_ALLOWED_NAVS: Record<UserRole, NavSectionId[]> = {
  [UserRole.ADMIN]: [
    'overview',
    'gis-map',
    'rainfall',
    'ai-risk',
    'simulator',
    'drainage',
    'incidents',
    'analytics',
    'officers',
    'users',
    'datasets',
  ],
  [UserRole.OFFICER]: [
    'overview',
    'gis-map',
    'incidents',
    'drainage',
    'ai-risk',
    'rainfall',
    'simulator',
    'analytics',
  ],
  [UserRole.CITIZEN]: [
    'overview',
    'gis-map',
    'report-incident',
    'my-complaints',
    'public-alerts',
  ],
};

export function canAccessNav(
  role: UserRole | undefined | null,
  nav: NavSectionId
): boolean {
  if (!role) return false;
  return ROLE_ALLOWED_NAVS[role].includes(nav);
}

export function getOfficerAssignedWardIds(
  user: DemoUser | null | undefined
): string[] {
  if (!user || user.role !== UserRole.OFFICER) return [];
  const primary = user.assignedWardIds ?? [];
  const backup = user.backupWardIds ?? [];
  return Array.from(new Set([...primary, ...backup]));
}

export function canUserAccessWard(
  user: DemoUser | null | undefined,
  wardId: string
): boolean {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.OFFICER) {
    return getOfficerAssignedWardIds(user).includes(wardId);
  }
  // Citizens have public read visibility for ward risk locations
  return true;
}

export function canMutateOperationalData(
  user: DemoUser | null | undefined,
  wardId: string
): boolean {
  if (!user || !user.active) return false;
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.OFFICER) {
    return getOfficerAssignedWardIds(user).includes(wardId);
  }
  return false;
}

export function canConfigureSystem(
  user: DemoUser | null | undefined
): boolean {
  return Boolean(user && user.active && user.role === UserRole.ADMIN);
}

export function formatWardScopeLabel(
  assignedWardIds: string[],
  backupWardIds: string[],
  zones: WardRiskZone[]
): string {
  const numFor = (id: string) =>
    zones.find((z) => z.id === id)?.wardNumber;

  const primaryNums = assignedWardIds
    .map(numFor)
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b);

  const backupNums = backupWardIds
    .map(numFor)
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b);

  if (primaryNums.length === 0 && backupNums.length === 0) {
    return 'No wards assigned';
  }

  const parts: string[] = [];
  if (primaryNums.length > 0) {
    parts.push(`Wards ${primaryNums.join(', ')}`);
  }
  if (backupNums.length > 0) {
    parts.push(`Backup: ${backupNums.join(', ')}`);
  }
  return parts.join(' · ');
}

export interface WardAssignmentValidationResult {
  ok: boolean;
  error?: string;
  conflictOfficer?: DemoUser;
}

/**
 * Enforces the core rule: an ordinary ward must NOT be assigned to multiple officers
 * simultaneously unless Admin explicitly requests a Reassign or Authorized Backup/Shared link.
 */
export function validateWardAssignment(
  users: DemoUser[],
  targetOfficerId: string,
  wardId: string,
  zones: WardRiskZone[],
  options?: {
    allowReassign?: boolean;
    asAuthorizedBackup?: boolean;
  }
): WardAssignmentValidationResult {
  const targetOfficer = users.find((u) => u.id === targetOfficerId);
  if (!targetOfficer || targetOfficer.role !== UserRole.OFFICER) {
    return {
      ok: false,
      error: 'Selected user is not a valid municipal officer account.',
    };
  }

  const zone = zones.find((z) => z.id === wardId);
  if (!zone) {
    return {
      ok: false,
      error: 'Selected ward does not exist in the Vijayawada registry.',
    };
  }

  const targetPrimary = targetOfficer.assignedWardIds ?? [];
  const targetBackup = targetOfficer.backupWardIds ?? [];

  if (options?.asAuthorizedBackup) {
    if (targetPrimary.includes(wardId)) {
      return {
        ok: false,
        error: `Ward ${zone.wardNumber} (${zone.name}) is already a primary assignment for ${targetOfficer.name}.`,
      };
    }
    if (targetBackup.includes(wardId)) {
      return {
        ok: false,
        error: `${targetOfficer.name} already holds an authorized backup assignment for Ward ${zone.wardNumber}.`,
      };
    }
    return { ok: true };
  }

  if (targetPrimary.includes(wardId)) {
    return {
      ok: false,
      error: `Ward ${zone.wardNumber} (${zone.name}) is already assigned to ${targetOfficer.name}.`,
    };
  }

  const existingPrimaryOwner = users.find(
    (u) =>
      u.role === UserRole.OFFICER &&
      u.id !== targetOfficerId &&
      (u.assignedWardIds ?? []).includes(wardId)
  );

  if (existingPrimaryOwner && !options?.allowReassign) {
    return {
      ok: false,
      conflictOfficer: existingPrimaryOwner,
      error: `Duplicate ward assignment blocked: Ward ${zone.wardNumber} (${zone.name}) is already assigned to ${existingPrimaryOwner.name}. Reassign the ward or explicitly authorize a backup/shared assignment.`,
    };
  }

  return {
    ok: true,
    conflictOfficer: existingPrimaryOwner,
  };
}

export function getUnassignedWards(
  users: DemoUser[],
  zones: WardRiskZone[]
): WardRiskZone[] {
  const assignedSet = new Set<string>();
  for (const user of users) {
    if (user.role === UserRole.OFFICER) {
      for (const id of user.assignedWardIds ?? []) {
        assignedSet.add(id);
      }
    }
  }
  return zones.filter((z) => !assignedSet.has(z.id));
}

export interface OfficerPerformanceSummary {
  officerId: string;
  primaryWardCount: number;
  backupWardCount: number;
  totalIncidents: number;
  pendingIncidents: number;
  resolvedIncidents: number;
  resolutionRatePct: number;
  assignedDrainsCount: number;
  blockedDrainsCount: number;
  openTasksCount: number;
  completedTasksCount: number;
}

export function computeOfficerPerformance(
  officer: DemoUser,
  incidents: IncidentReport[],
  drains: DrainageAsset[],
  tasks: MaintenanceTask[]
): OfficerPerformanceSummary {
  const effectiveWards = getOfficerAssignedWardIds(officer);
  const wardSet = new Set(effectiveWards);

  const scopedIncidents = incidents.filter((i) => wardSet.has(i.wardId));
  const resolvedIncidents = scopedIncidents.filter(
    (i) => i.status === IncidentStatus.RESOLVED
  ).length;
  const pendingIncidents = scopedIncidents.filter(
    (i) =>
      i.status === IncidentStatus.PENDING ||
      i.status === IncidentStatus.VERIFIED ||
      i.status === IncidentStatus.IN_PROGRESS
  ).length;

  const scopedDrains = drains.filter((d) => wardSet.has(d.wardId));
  const blockedDrainsCount = scopedDrains.filter(
    (d) => d.blockedReported || d.condition === DrainCondition.BLOCKED
  ).length;

  const scopedTasks = tasks.filter((t) => wardSet.has(t.wardId));
  const completedTasksCount = scopedTasks.filter(
    (t) => t.status === MaintenanceStatus.COMPLETED
  ).length;
  const openTasksCount = scopedTasks.length - completedTasksCount;

  return {
    officerId: officer.id,
    primaryWardCount: (officer.assignedWardIds ?? []).length,
    backupWardCount: (officer.backupWardIds ?? []).length,
    totalIncidents: scopedIncidents.length,
    pendingIncidents,
    resolvedIncidents,
    resolutionRatePct:
      scopedIncidents.length > 0
        ? Math.round((resolvedIncidents / scopedIncidents.length) * 100)
        : 0,
    assignedDrainsCount: scopedDrains.length,
    blockedDrainsCount,
    openTasksCount,
    completedTasksCount,
  };
}

export interface PublicCitizenIncidentView {
  id: string;
  title: string;
  location: string;
  wardId: string;
  wardName: string;
  severity: IncidentReport['severity'];
  publicStatusLabel: string;
  createdAt: string;
  lat?: number;
  lng?: number;
}

/**
 * Strips reporter identity, private photo evidence, internal crew dispatch,
 * and officer inspection notes before showing nearby incidents on the public map.
 */
export function sanitizeIncidentForCitizenMap(
  incident: IncidentReport
): PublicCitizenIncidentView {
  const publicStatusLabel =
    incident.status === IncidentStatus.RESOLVED
      ? 'Resolved'
      : incident.status === IncidentStatus.IN_PROGRESS
      ? 'Response Active'
      : incident.status === IncidentStatus.VERIFIED
      ? 'Verified Hazard'
      : 'Reported Hazard';

  return {
    id: incident.id,
    title: incident.title,
    location: incident.location,
    wardId: incident.wardId,
    wardName: incident.wardName,
    severity: incident.severity,
    publicStatusLabel,
    createdAt: incident.createdAt,
    lat: incident.lat,
    lng: incident.lng,
  };
}
