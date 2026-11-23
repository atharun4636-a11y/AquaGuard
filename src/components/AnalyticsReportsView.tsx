import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import { HISTORICAL_7DAY_SERIES } from '../data/vijayawadaSeed';
import { IncidentStatus, MaintenanceStatus, RiskLevel, UserRole } from '../types/aquaguard';
import { computeCityMetrics } from '../utils/riskEngine';
import { getRiskHexColor, KpiCard, SectionHeader } from './UiPrimitives';

export const AnalyticsReportsView: React.FC = () => {
  const {
    currentUser,
    assignedWardIdsForCurrentOfficer,
    zones,
    zoneAssessments,
    incidents,
    drains,
    tasks,
    weights,
    scenario,
    customRainfallMmHr,
  } = useAquaGuard();

  const isOfficer = currentUser?.role === UserRole.OFFICER;

  const { scopedZones, scopedIncidents, scopedTasks, scopedMetrics } = useMemo(() => {
    if (!isOfficer) {
      return {
        scopedZones: zones,
        scopedIncidents: incidents,
        scopedTasks: tasks,
        scopedMetrics: computeCityMetrics(
          zones,
          incidents,
          drains,
          tasks,
          weights,
          scenario,
          customRainfallMmHr
        ),
      };
    }
    const wardSet = new Set(assignedWardIdsForCurrentOfficer);
    const fZones = zones.filter((z) => wardSet.has(z.id));
    const fIncidents = incidents.filter((i) => wardSet.has(i.wardId));
    const fDrains = drains.filter((d) => wardSet.has(d.wardId));
    const fTasks = tasks.filter((t) => wardSet.has(t.wardId));
    return {
      scopedZones: fZones,
      scopedIncidents: fIncidents,
      scopedTasks: fTasks,
      scopedMetrics: computeCityMetrics(
        fZones,
        fIncidents,
        fDrains,
        fTasks,
        weights,
        scenario,
        customRainfallMmHr
      ),
    };
  }, [
    isOfficer,
    assignedWardIdsForCurrentOfficer,
    zones,
    incidents,
    drains,
    tasks,
    weights,
    scenario,
    customRainfallMmHr,
  ]);

  const sortedZones = [...scopedZones].sort(
    (a, b) => zoneAssessments[b.id].score - zoneAssessments[a.id].score
  );

  const incidentTrend = [
    { day: 'Nov 17', count: isOfficer ? 1 : 2 },
    { day: 'Nov 18', count: isOfficer ? 1 : 3 },
    { day: 'Nov 19', count: isOfficer ? 2 : 6 },
    { day: 'Nov 20', count: isOfficer ? 2 : 4 },
    { day: 'Nov 21', count: isOfficer ? 3 : 8 },
    { day: 'Nov 22', count: isOfficer ? 3 : 9 },
    { day: 'Nov 23', count: scopedIncidents.length },
  ];

  const riskDist = [
    { level: RiskLevel.CRITICAL, count: scopedMetrics.criticalWardsCount, color: '#EF4444' },
    { level: RiskLevel.HIGH, count: scopedMetrics.highWardsCount, color: '#F97316' },
    { level: RiskLevel.MEDIUM, count: scopedMetrics.mediumWardsCount, color: '#EAB308' },
    { level: RiskLevel.LOW, count: scopedMetrics.lowWardsCount, color: '#16A34A' },
  ];

  const handleExportCsv = () => {
    const header = 'WardNumber,WardName,Scenario,RiskScore,RiskCategory,OpenIncidents\n';
    const rows = sortedZones
      .map((z) => {
        const res = zoneAssessments[z.id];
        const openCount = scopedIncidents.filter(
          (i) => i.wardId === z.id && i.status !== IncidentStatus.RESOLVED
        ).length;
        return `${z.wardNumber},"${z.name}",${scenario},${res.score},${res.category},${openCount}`;
      })
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aquaguard-vijayawada-${isOfficer ? 'assigned-wards-' : ''}${scenario.toLowerCase()}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Analytics & Municipal Reports"
        subtitle={
          isOfficer
            ? `Waterlogging risk comparison, complaint resolution, and maintenance summary for your ${scopedZones.length} assigned Vijayawada wards.`
            : 'Cross-ward waterlogging risk comparison, complaint resolution metrics, pending maintenance tasks, and sample rainfall correlation.'
        }
        dataTag={
          isOfficer
            ? `Assigned Wards Scope (${scopedZones.length} Wards) · Scenario: ${scenario}`
            : `Illustrative Analytics · Scenario: ${scenario}`
        }
        action={
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#243758] bg-[#0F192D] px-3.5 py-2 text-xs font-medium text-slate-100 hover:border-teal-500/60 transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
            <span>Export CSV Summary</span>
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={isOfficer ? 'Assigned Mean Risk Score' : 'City Mean Risk Score'}
          value={`${scopedMetrics.averageRiskScore}/100`}
          detail={`Across ${scopedZones.length} ${scopedZones.length === 1 ? 'ward' : 'wards'} (${scenario})`}
          tone="teal"
        />
        <KpiCard
          label="Resolved Complaints"
          value={scopedMetrics.resolvedIncidents}
          detail={`Out of ${scopedMetrics.totalIncidents} total reports`}
          tone="emerald"
        />
        <KpiCard
          label="Pending Maintenance Tasks"
          value={scopedMetrics.openTasksCount}
          detail={`${scopedTasks.filter((t) => t.status === MaintenanceStatus.PENDING).length} awaiting dispatch`}
          tone="amber"
        />
        <KpiCard
          label="High / Critical Wards"
          value={scopedMetrics.highWardsCount + scopedMetrics.criticalWardsCount}
          detail="Simulated high-exposure zones"
          tone="rose"
        />
      </div>

      {/* Ward-Wise Risk Comparison & Risk Distribution */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Ward-Wise Waterlogging Risk Comparison
              </h3>
              <p className="text-xs text-slate-400">
                Ranked risk scores under {scenario} rainfall scenario
              </p>
            </div>
            <span className="font-mono text-xs text-slate-400">0–100 Scale</span>
          </div>

          <div className="space-y-2.5">
            {sortedZones.map((zone) => {
              const res = zoneAssessments[zone.id];
              const hex = getRiskHexColor(res.category);
              const wardIncidents = scopedIncidents.filter((i) => i.wardId === zone.id).length;
              return (
                <div key={zone.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      {zone.name}
                      <span className="ml-2 text-[11px] text-slate-400">
                        ({wardIncidents} {wardIncidents === 1 ? 'report' : 'reports'})
                      </span>
                    </span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {res.score} · {res.category}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded bg-[#08101E] overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${res.score}%`,
                        backgroundColor: hex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Risk Tier Distribution
            </h3>
            <p className="text-xs text-slate-400">
              Proportion of monitored {isOfficer ? 'assigned' : 'Vijayawada'} wards by category
            </p>
          </div>

          <div className="flex h-4 w-full overflow-hidden rounded-full bg-[#08101E]">
            {riskDist.map((seg) => {
              const pct = scopedZones.length > 0 ? (seg.count / scopedZones.length) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={seg.level}
                  style={{ width: `${pct}%`, backgroundColor: seg.color }}
                  title={`${seg.level}: ${seg.count} wards`}
                />
              );
            })}
          </div>

          <div className="space-y-2">
            {riskDist.map((seg) => (
              <div
                key={seg.level}
                className="flex items-center justify-between rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3 py-2 text-xs"
              >
                <span className="inline-flex items-center gap-2 text-slate-200">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden="true"
                  />
                  <span>{seg.level} Risk</span>
                </span>
                <span className="font-mono font-semibold text-slate-100 tabular-nums">
                  {seg.count} {seg.count === 1 ? 'ward' : 'wards'}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#1E2F4D] pt-4 space-y-2">
            <div className="text-xs font-medium text-slate-300">
              Operations Resolution Summary
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Resolved Complaints</span>
              <span className="font-mono text-emerald-400 tabular-nums">
                {scopedMetrics.resolvedIncidents} / {scopedMetrics.totalIncidents}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Completed Drain Tasks</span>
              <span className="font-mono text-teal-400 tabular-nums">
                {scopedMetrics.completedTasksCount} / {scopedTasks.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Incident Trend & Rainfall Correlation */}
      <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              7-Day Sample Incident &amp; Rainfall Correlation
            </h3>
            <p className="text-xs text-slate-400">
              Sample daily rainfall (mm) overlaid with reported waterlogging incidents
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-teal-500/70" aria-hidden="true" />
              Sample Rainfall (mm)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-amber-400" aria-hidden="true" />
              Incidents Count
            </span>
          </div>
        </div>

        <svg
          viewBox="0 0 700 220"
          className="w-full h-auto"
          role="img"
          aria-label="7-day incident and rainfall correlation chart"
        >
          {[0, 0.5, 1].map((f) => {
            const y = 180 - f * 140;
            return (
              <line
                key={f}
                x1="40"
                y1={y}
                x2="660"
                y2={y}
                stroke="#1E2F4D"
                strokeDasharray="3 3"
              />
            );
          })}

          {HISTORICAL_7DAY_SERIES.map((pt, idx) => {
            const slotW = (660 - 60) / HISTORICAL_7DAY_SERIES.length;
            const barW = 36;
            const x = 60 + idx * slotW + (slotW - barW) / 2;
            const h = (pt.rainfallMm / 95) * 140;
            const y = 180 - h;
            return (
              <g key={pt.label}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx="3"
                  fill="#0D9488"
                  opacity="0.7"
                />
                <text
                  x={x + barW / 2}
                  y="202"
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="11"
                >
                  {pt.label}
                </text>
              </g>
            );
          })}

          {/* Incident Line Overlay */}
          {(() => {
            const slotW = (660 - 60) / incidentTrend.length;
            const maxInc = Math.max(...incidentTrend.map((d) => d.count), 10);
            const points = incidentTrend
              .map((d, idx) => {
                const cx = 60 + idx * slotW + slotW / 2;
                const cy = 180 - (d.count / maxInc) * 135;
                return `${cx},${cy}`;
              })
              .join(' ');
            return (
              <g>
                <polyline
                  points={points}
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="2.5"
                />
                {incidentTrend.map((d, idx) => {
                  const cx = 60 + idx * slotW + slotW / 2;
                  const cy = 180 - (d.count / maxInc) * 135;
                  return (
                    <g key={d.day}>
                      <circle cx={cx} cy={cy} r="4" fill="#FBBF24" stroke="#08101E" strokeWidth="1.5" />
                      <text
                        x={cx}
                        y={cy - 9}
                        textAnchor="middle"
                        fill="#FDE68A"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {d.count}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
};
