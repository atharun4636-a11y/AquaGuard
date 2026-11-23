import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CloudRain,
  Droplets,
  Gauge,
  Info,
} from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import {
  HISTORICAL_7DAY_SERIES,
  RAINFALL_24H_SERIES,
} from '../data/vijayawadaSeed';
import { UserRole } from '../types/aquaguard';
import { getScenarioModifiers } from '../utils/riskEngine';
import { KpiCard, RiskLabel, SectionHeader } from './UiPrimitives';

export const RainfallWeatherView: React.FC = () => {
  const {
    currentUser,
    assignedWardIdsForCurrentOfficer,
    zones,
    scenario,
    customRainfallMmHr,
    alerts,
  } = useAquaGuard();
  const [seriesMode, setSeriesMode] = useState<'24h' | '7d'>('24h');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const isOfficer = currentUser?.role === UserRole.OFFICER;
  const scopedAlerts = useMemo(() => {
    if (!isOfficer) return alerts;
    const wardSet = new Set(assignedWardIdsForCurrentOfficer);
    const assignedNames = new Set(
      zones.filter((z) => wardSet.has(z.id)).map((z) => z.name)
    );
    const matched = alerts.filter((a) =>
      a.affectedWards.some((w) => assignedNames.has(w))
    );
    return matched.length > 0 ? matched : alerts;
  }, [isOfficer, alerts, zones, assignedWardIdsForCurrentOfficer]);

  const mod = getScenarioModifiers(scenario, customRainfallMmHr);
  const series = seriesMode === '24h' ? RAINFALL_24H_SERIES : HISTORICAL_7DAY_SERIES;
  const maxVal = Math.max(...series.map((s) => Math.max(s.rainfallMm, s.thresholdMm)), 50);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Rainfall & Weather Intelligence"
        subtitle={
          isOfficer
            ? `Station intensity overview, sample historical rainfall trends, and weather alerts relevant to your assigned Vijayawada wards.`
            : 'Station intensity overview, sample historical rainfall trends, and municipal weather alerts for Vijayawada.'
        }
        dataTag={
          isOfficer
            ? `Assigned Wards Alerts (${scopedAlerts.length}) · Sample Historical & Simulated Data`
            : 'Sample Historical & Simulated Data · No Live IMD/AWS Connection'
        }
      />

      {/* Explicit Data Provenance Banner */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[#1E2F4D] bg-[#0B1424] px-4 py-3 text-xs text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
        <div>
          <span className="font-semibold text-slate-100">
            Data Source Distinction:{' '}
          </span>
          Station intensity and daily accumulation below reflect the active{' '}
          <span className="text-teal-300 font-medium">{scenario}</span> simulation
          profile. Historical 24-hour and 7-day charts display fixed{' '}
          <span className="text-amber-300 font-medium">Sample Historical Data</span>{' '}
          for prototype demonstration—not live meteorological telemetry.
        </div>
      </div>

      {/* Rainfall KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active Scenario Intensity"
          value={`${mod.rainfallMmHr} mm/hr`}
          detail={`${mod.label} (Simulated)`}
          tone={mod.rainfallMmHr >= 60 ? 'rose' : mod.rainfallMmHr >= 35 ? 'amber' : 'teal'}
        />
        <KpiCard
          label="Simulated 24h Accumulation"
          value={`${mod.dailyAccumulationMm} mm`}
          detail="Projected basin total (Demo)"
          tone="neutral"
        />
        <KpiCard
          label="Sample Peak 7-Day Log"
          value="82 mm"
          detail="Nov 22 · Central Vijayawada (Sample)"
          tone="amber"
        />
        <KpiCard
          label={isOfficer ? 'Relevant Ward Advisories' : 'Active Weather Advisories'}
          value={scopedAlerts.length}
          detail="Sample municipal rainfall bulletins"
          tone="rose"
        />
      </div>

      {/* Interactive Rainfall Trend Chart + Thresholds */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {seriesMode === '24h'
                  ? '24-Hour Sample Rainfall Distribution (mm)'
                  : '7-Day Sample Historical Rainfall Trend (mm)'}
              </h3>
              <p className="text-xs text-slate-400">
                Sample historical series compared against local drainage runoff threshold
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-[#1E2F4D] bg-[#08101E] p-1 self-start">
              <button
                type="button"
                onClick={() => {
                  setSeriesMode('24h');
                  setHoveredIdx(null);
                }}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  seriesMode === '24h'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                24-Hour Log
              </button>
              <button
                type="button"
                onClick={() => {
                  setSeriesMode('7d');
                  setHoveredIdx(null);
                }}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  seriesMode === '7d'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7-Day Trend
              </button>
            </div>
          </div>

          <div className="relative pt-2">
            <svg
              viewBox="0 0 680 260"
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label="Sample rainfall trend chart"
            >
              {/* Y-axis gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = 215 - frac * 175;
                const val = Math.round(maxVal * frac);
                return (
                  <g key={frac}>
                    <line
                      x1="46"
                      y1={y}
                      x2="660"
                      y2={y}
                      stroke="#1E2F4D"
                      strokeDasharray={frac === 0 ? undefined : '3 3'}
                    />
                    <text
                      x="38"
                      y={y + 4}
                      textAnchor="end"
                      fill="#94A3B8"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Threshold reference line */}
              {(() => {
                const thresh = series[0].thresholdMm;
                const ty = 215 - (thresh / maxVal) * 175;
                return (
                  <g>
                    <line
                      x1="46"
                      y1={ty}
                      x2="660"
                      y2={ty}
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                    />
                    <text
                      x="656"
                      y={ty - 6}
                      textAnchor="end"
                      fill="#FCD34D"
                      fontSize="10"
                    >
                      Runoff Alert Threshold ({thresh} mm)
                    </text>
                  </g>
                );
              })()}

              {/* Bars */}
              {series.map((pt, idx) => {
                const slotW = (660 - 60) / series.length;
                const barW = Math.min(44, slotW * 0.56);
                const x = 60 + idx * slotW + (slotW - barW) / 2;
                const h = Math.max(4, (pt.rainfallMm / maxVal) * 175);
                const y = 215 - h;
                const aboveThreshold = pt.rainfallMm >= pt.thresholdMm;
                const isHovered = hoveredIdx === idx;

                return (
                  <g
                    key={pt.label}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx="3"
                      fill={
                        aboveThreshold
                          ? isHovered
                            ? '#FB923C'
                            : '#F97316'
                          : isHovered
                          ? '#2DD4BF'
                          : '#14B8A6'
                      }
                    />
                    <text
                      x={x + barW / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {pt.rainfallMm}
                    </text>
                    <text
                      x={x + barW / 2}
                      y="236"
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="10.5"
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1E2F4D] pt-3 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" aria-hidden="true" />
                Within Conveyance Margin
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" aria-hidden="true" />
                Exceeds Threshold
              </span>
            </div>
            <span className="font-mono text-[11px]">
              {hoveredIdx !== null
                ? `${series[hoveredIdx].label}: ${series[hoveredIdx].rainfallMm} mm (${series[hoveredIdx].intensityMmHr} mm/hr peak)`
                : 'Hover a bar to inspect interval intensity'}
            </span>
          </div>
        </div>

        {/* Intensity Gauge & Zone Advisories */}
        <div className="lg:col-span-4 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Runoff Stress Indicator
            </h3>
            <Gauge className="h-4 w-4 text-teal-400" aria-hidden="true" />
          </div>

          <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Current Scenario Rate</span>
              <span className="font-mono text-2xl font-semibold text-teal-300 tabular-nums">
                {mod.rainfallMmHr} mm/hr
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#162238] overflow-hidden">
              <div
                className={`h-full transition-all ${
                  mod.rainfallMmHr >= 65
                    ? 'bg-rose-500'
                    : mod.rainfallMmHr >= 35
                    ? 'bg-orange-500'
                    : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(100, Math.round((mod.rainfallMmHr / 90) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {mod.description}
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-medium text-slate-300">
              Sample Station Comparison
            </div>
            {[
              { name: 'Benz Circle AWS (Demo)', mm: Math.round(mod.rainfallMmHr * 1.05) },
              { name: 'Singh Nagar AWS (Demo)', mm: Math.round(mod.rainfallMmHr * 1.12) },
              { name: 'Bhavanipuram AWS (Demo)', mm: Math.round(mod.rainfallMmHr * 0.88) },
              { name: 'Kanuru AWS (Demo)', mm: Math.round(mod.rainfallMmHr * 0.78) },
            ].map((st) => (
              <div
                key={st.name}
                className="flex items-center justify-between rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3 py-2 text-xs"
              >
                <span className="inline-flex items-center gap-2 text-slate-300">
                  <Droplets className="h-3.5 w-3.5 text-teal-400 shrink-0" aria-hidden="true" />
                  <span>{st.name}</span>
                </span>
                <span className="font-mono font-medium text-slate-100 tabular-nums">
                  {st.mm} mm/hr
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rainfall & Hydro Alerts */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">
          Rainfall &amp; Waterlogging Alerts (Sample Municipal Bulletins)
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {scopedAlerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-4 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400">
                    <CloudRain className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                    <span>{alert.id}</span>
                  </span>
                  <RiskLabel level={alert.severity} />
                </div>
                <h4 className="text-sm font-semibold text-slate-100">
                  {alert.title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {alert.summary}
                </p>
              </div>
              <div className="space-y-2 border-t border-[#1E2F4D] pt-3 text-xs">
                <div className="text-slate-400">
                  <span className="font-medium text-slate-200">Action: </span>
                  {alert.advisory}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{alert.sourceLabel}</span>
                  <span className="font-mono">{alert.issuedAt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <AlertCircle className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        <span>
          Simulated rainfall intensity updates automatically when switching scenarios in the top bar or Simulator.
        </span>
      </div>
    </div>
  );
};
