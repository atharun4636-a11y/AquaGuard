import React from 'react';
import {
  ArrowRight,
  CloudRain,
  Wrench,
  Activity,
} from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import { DrainCondition, IncidentStatus, MaintenanceStatus, RiskLevel, UserRole } from '../types/aquaguard';
import { getScenarioModifiers } from '../utils/riskEngine';
import {
  IncidentStatusBadge,
  KpiCard,
  MaintenanceStatusBadge,
  RiskLabel,
  SectionHeader,
} from './UiPrimitives';
import { VijayawadaGisMap } from './VijayawadaGisMap';

export const AdminOverviewDashboard: React.FC = () => {
  const {
    zones,
    zoneAssessments,
    incidents,
    metrics,
    activities,
    users,
    scenario,
    customRainfallMmHr,
    setActiveNav,
  } = useAquaGuard();

  const mod = getScenarioModifiers(scenario, customRainfallMmHr);
  const topWards = [...zones]
    .sort((a, b) => zoneAssessments[b.id].score - zoneAssessments[a.id].score)
    .slice(0, 5);

  const assignedWardSet = new Set<string>();
  users
    .filter((u) => u.role === UserRole.OFFICER)
    .forEach((u) => (u.assignedWardIds ?? []).forEach((id) => assignedWardSet.add(id)));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="City-Wide Command Overview"
        subtitle="Executive governance view across all Vijayawada wards, simulated rainfall scenarios, citizen incidents, and municipal maintenance activity."
        dataTag={`Simulated ${scenario} Scenario · ${mod.rainfallMmHr} mm/hr · ${assignedWardSet.size}/${zones.length} Wards Assigned`}
        action={
          <button
            type="button"
            onClick={() => setActiveNav('officers')}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#243758] bg-[#0F192D] px-3.5 py-2 text-xs font-medium text-teal-300 hover:border-teal-500/60 transition-colors whitespace-nowrap"
          >
            <span>Manage Officers &amp; Wards</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="City Mean Waterlogging Risk"
          value={`${metrics.averageRiskScore}/100`}
          detail={`${metrics.criticalWardsCount} Critical · ${metrics.highWardsCount} High wards`}
          tone={metrics.averageRiskScore >= 65 ? 'rose' : 'teal'}
        />
        <KpiCard
          label="Open Citizen Incidents"
          value={metrics.pendingIncidents}
          detail={`${metrics.resolvedIncidents} resolved · ${metrics.totalIncidents} total`}
          tone="amber"
        />
        <KpiCard
          label="Blocked / Critical Drains"
          value={metrics.blockedDrainsCount}
          detail={`${metrics.openTasksCount} maintenance tasks open`}
          tone="rose"
        />
        <KpiCard
          label="Simulated Rainfall Load"
          value={`${mod.rainfallMmHr} mm/hr`}
          detail={`${mod.dailyAccumulationMm} mm 24h est. (Demo)`}
          tone="teal"
        />
      </div>

      {/* Prominent GIS Risk Map Embedded on Overview */}
      <VijayawadaGisMap compact />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Ward-Wise Risk Monitor */}
        <div className="lg:col-span-7 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Priority Ward Risk Monitor
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('ai-risk')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300"
            >
              <span>Configure Factors</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-2">
            {topWards.map((z) => {
              const res = zoneAssessments[z.id];
              return (
                <div
                  key={z.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-100">
                      Ward {z.wardNumber} · {z.name}
                    </div>
                    <div className="text-[11px] text-slate-400">{z.landmark}</div>
                  </div>
                  <RiskLabel level={res.category} score={res.score} />
                </div>
              );
            })}
          </div>
        </div>

        {/* System Activity Log */}
        <div className="lg:col-span-5 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Recent System Activity
            </h3>
            <Activity className="h-4 w-4 text-teal-400" aria-hidden="true" />
          </div>
          <div className="space-y-2.5">
            {activities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3 py-2.5 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-medium text-teal-300">{act.actor}</span>
                  <span className="font-mono">{act.timestamp}</span>
                </div>
                <div className="mt-1 text-slate-200">
                  {act.action} <span className="text-slate-100 font-medium">{act.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const OfficerOverviewDashboard: React.FC = () => {
  const {
    currentUser,
    zones,
    zoneAssessments,
    assignedWardIdsForCurrentOfficer,
    incidents,
    drains,
    tasks,
    alerts,
    scenario,
    customRainfallMmHr,
    setActiveNav,
  } = useAquaGuard();

  const mod = getScenarioModifiers(scenario, customRainfallMmHr);
  const wardSet = new Set(assignedWardIdsForCurrentOfficer);
  const assignedZones = zones.filter((z) => wardSet.has(z.id));
  const assignedIncidents = incidents.filter((i) => wardSet.has(i.wardId));
  const assignedDrains = drains.filter((d) => wardSet.has(d.wardId));
  const assignedTasks = tasks.filter((t) => wardSet.has(t.wardId));

  const pendingComplaints = assignedIncidents.filter(
    (i) => i.status !== IncidentStatus.RESOLVED
  );
  const resolvedCount = assignedIncidents.filter(
    (i) => i.status === IncidentStatus.RESOLVED
  ).length;
  const openTasks = assignedTasks.filter(
    (t) => t.status !== MaintenanceStatus.COMPLETED
  );
  const blockedDrainsCount = assignedDrains.filter(
    (d) => d.blockedReported || d.condition === DrainCondition.BLOCKED
  ).length;
  const highRiskAssignedCount = assignedZones.filter(
    (z) =>
      zoneAssessments[z.id].category === RiskLevel.CRITICAL ||
      zoneAssessments[z.id].category === RiskLevel.HIGH
  ).length;

  const assignedWardNames = new Set(assignedZones.map((z) => z.name));
  const relevantAlerts = alerts.filter((a) =>
    a.affectedWards.some((name) => assignedWardNames.has(name))
  );
  const topAlert = relevantAlerts[0] ?? alerts[0];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Municipal Officer Operations Overview"
        subtitle={`Assigned jurisdiction operations for ${currentUser?.name ?? 'Officer'} (${assignedZones.length} assigned Vijayawada wards).`}
        dataTag={`Jurisdiction: ${currentUser?.wardScope ?? 'No wards'} · ${scenario} (${mod.rainfallMmHr} mm/hr)`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pending Complaints (My Wards)"
          value={pendingComplaints.length}
          detail={`${assignedIncidents.filter((i) => i.status === IncidentStatus.PENDING).length} awaiting verification`}
          tone="amber"
        />
        <KpiCard
          label="Open Maintenance Tasks"
          value={openTasks.length}
          detail={`${blockedDrainsCount} blocked drains in assigned wards`}
          tone="rose"
        />
        <KpiCard
          label="Critical / High Assigned Wards"
          value={highRiskAssignedCount}
          detail={`Out of ${assignedZones.length} assigned wards`}
          tone="teal"
        />
        <KpiCard
          label="Resolved Incidents (My Wards)"
          value={resolvedCount}
          detail="Cleared in assigned jurisdiction"
          tone="emerald"
        />
      </div>

      {/* Prominent GIS Risk Map (automatically scoped to Officer's assigned wards) */}
      <VijayawadaGisMap compact />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Incoming Citizen Complaints Queue (Assigned Wards Only) */}
        <div className="lg:col-span-6 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Assigned-Ward Complaints Requiring Action
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('incidents')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300"
            >
              <span>Open Verification Queue</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {pendingComplaints.length === 0 ? (
            <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-4 text-xs text-slate-400">
              No pending complaints in your assigned wards.
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingComplaints.slice(0, 4).map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-100">
                      {inc.title}
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      {inc.id} · {inc.wardName} · {inc.location}
                    </div>
                  </div>
                  <IncidentStatusBadge status={inc.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drainage Maintenance Priorities & Active Weather Alerts */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-teal-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Assigned Drainage Tasks
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('drainage')}
                className="text-xs font-medium text-teal-400 hover:text-teal-300"
              >
                Manage Tasks
              </button>
            </div>
            {openTasks.length === 0 ? (
              <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-3 text-xs text-slate-400">
                All drainage maintenance tasks in your assigned wards are completed.
              </div>
            ) : (
              <div className="space-y-2">
                {openTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-100">
                        {t.title}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {t.assignedTeam} · {t.wardName}
                      </div>
                    </div>
                    <MaintenanceStatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudRain className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Assigned Ward Risk &amp; Rainfall Alert
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('rainfall')}
                className="text-xs font-medium text-teal-400 hover:text-teal-300"
              >
                Weather Intel
              </button>
            </div>
            {topAlert && (
              <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">
                    {topAlert.title}
                  </span>
                  <RiskLabel level={topAlert.severity} />
                </div>
                <p className="text-slate-300">{topAlert.advisory}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {[...assignedZones]
                .sort((a, b) => zoneAssessments[b.id].score - zoneAssessments[a.id].score)
                .slice(0, 3)
                .map((z) => (
                  <div
                    key={z.id}
                    className="flex-1 min-w-[140px] rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5 text-xs"
                  >
                    <div className="truncate font-medium text-slate-200">
                      {z.name}
                    </div>
                    <div className="mt-1">
                      <RiskLabel
                        level={zoneAssessments[z.id].category}
                        score={zoneAssessments[z.id].score}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
