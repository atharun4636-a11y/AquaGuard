import React, { useMemo, useState } from 'react';
import { BrainCircuit, Info, RotateCcw, Sliders } from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import { RiskWeights, UserRole } from '../types/aquaguard';
import { normalizeWeights } from '../utils/riskEngine';
import { RiskLabel, SectionHeader } from './UiPrimitives';

const WEIGHT_LABELS: { key: keyof RiskWeights; label: string; help: string }[] = [
  {
    key: 'rainfallIntensity',
    label: 'Rainfall Intensity',
    help: 'Sensitivity to short-duration storm intensity (mm/hr)',
  },
  {
    key: 'historicalFrequency',
    label: 'Historical Waterlogging Frequency',
    help: 'Recurrence of ponding in past monsoon logs',
  },
  {
    key: 'terrainElevation',
    label: 'Terrain & Elevation Conditions',
    help: 'Low-lying pocket / slope depression profile',
  },
  {
    key: 'drainageCondition',
    label: 'Drainage Condition & Siltation',
    help: 'Stormwater capacity deficit & blocked-drain pressure',
  },
  {
    key: 'locationVulnerability',
    label: 'Location & Asset Vulnerability',
    help: 'Traffic arterial density, schools, hospitals, underpasses',
  },
];

export const AiRiskAssessmentView: React.FC = () => {
  const {
    currentUser,
    assignedWardIdsForCurrentOfficer,
    zones,
    zoneAssessments,
    weights,
    setWeights,
    resetWeights,
    scenario,
  } = useAquaGuard();

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isOfficer = currentUser?.role === UserRole.OFFICER;

  const scopedZones = useMemo(() => {
    if (!isOfficer) return zones;
    const wardSet = new Set(assignedWardIdsForCurrentOfficer);
    return zones.filter((z) => wardSet.has(z.id));
  }, [zones, isOfficer, assignedWardIdsForCurrentOfficer]);

  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[7].id);

  const normalized = normalizeWeights(weights);

  const sortedZones = [...scopedZones].sort(
    (a, b) => zoneAssessments[b.id].score - zoneAssessments[a.id].score
  );
  const activeZone =
    scopedZones.find((z) => z.id === selectedZoneId) ??
    sortedZones[0] ??
    zones[0];
  const activeAssessment = zoneAssessments[activeZone.id];

  const handleWeightChange = (key: keyof RiskWeights, val: number) => {
    setWeights({
      ...weights,
      [key]: val,
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Transparent Waterlogging Risk Assessment"
        subtitle={
          isOfficer
            ? `Inspect factor-by-factor risk scores and explanations for your assigned Vijayawada wards (${scopedZones.length} wards).`
            : 'Inspect interpretable factor-by-factor risk scores and plain-language explanations across Vijayawada wards.'
        }
        dataTag={
          isOfficer
            ? `Assigned Wards Scope (${scopedZones.length} Wards) · Weighted Heuristic`
            : 'Transparent Demo Scoring Model (Weighted Heuristic — Not Trained ML)'
        }
      />

      {/* Explicit Transparency Notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[#1E2F4D] bg-[#0B1424] px-4 py-3 text-xs text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
        <div>
          <span className="font-semibold text-slate-100">Model Transparency: </span>
          Scores are computed deterministically from five weighted urban factors
          (Rainfall Intensity, Historical Frequency, Terrain/Elevation, Drainage
          Condition, and Location Vulnerability). This prototype demonstrates
          explainable decision support and is{' '}
          <span className="text-amber-300 font-medium">
            not a trained machine-learning model
          </span>
          .
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Ranked Location Risk Table + Weight Configuration */}
        <div className="lg:col-span-7 space-y-6">
          {/* Factor Weight Controls (Editable for Admin, Read-only summary for Officer) */}
          <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-teal-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Risk Assessment Factor Weights{' '}
                  {isAdmin ? '(Admin Configurable)' : '(Configured by Admin)'}
                </h3>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={resetWeights}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#243758] bg-[#0B1424] px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>Reset Defaults</span>
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {WEIGHT_LABELS.map((item) => {
                const effPct = Number(normalized[item.key].toFixed(1));
                return (
                  <div
                    key={item.key}
                    className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label
                        htmlFor={`weight-${item.key}`}
                        className="font-medium text-slate-200"
                      >
                        {item.label}
                      </label>
                      <span className="font-mono text-teal-300 tabular-nums">
                        {effPct}%
                      </span>
                    </div>
                    {isAdmin ? (
                      <input
                        id={`weight-${item.key}`}
                        type="range"
                        min={5}
                        max={60}
                        step={5}
                        value={weights[item.key]}
                        onChange={(e) =>
                          handleWeightChange(item.key, Number(e.target.value))
                        }
                        className="w-full accent-teal-500 cursor-pointer"
                      />
                    ) : (
                      <div className="h-1.5 w-full rounded-full bg-[#162238] overflow-hidden">
                        <div
                          className="h-full bg-teal-500"
                          style={{ width: `${effPct}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400">{item.help}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ranked Ward Scores Table */}
          <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] overflow-hidden">
            <div className="border-b border-[#1E2F4D] px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                {isOfficer ? 'Assigned Ward' : 'Vijayawada Ward'} Risk Rankings ({scenario} Scenario)
              </h3>
              <span className="text-xs text-slate-400">
                Click a ward to inspect reasons
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#1E2F4D] bg-[#0B1424] text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Ward</th>
                    <th className="px-4 py-2.5 font-medium">Key Corridor</th>
                    <th className="px-4 py-2.5 font-medium text-right">Score</th>
                    <th className="px-4 py-2.5 font-medium text-right">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2F4D]">
                  {sortedZones.map((zone) => {
                    const res = zoneAssessments[zone.id];
                    const isSelected = zone.id === activeZone.id;
                    return (
                      <tr
                        key={zone.id}
                        onClick={() => setSelectedZoneId(zone.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-teal-500/10'
                            : 'hover:bg-[#131F36]'
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-100">
                          <div>{zone.name}</div>
                          <div className="text-[11px] text-slate-400">
                            Ward {zone.wardNumber}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {zone.landmark}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-100 tabular-nums">
                          {res.score}/100
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <RiskLabel level={res.category} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Detailed Explainability Card */}
        <div className="lg:col-span-5">
          <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-5 sticky top-20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-teal-400">
                  <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Explainable Assessment · Ward {activeZone.wardNumber}</span>
                </div>
                <h3 className="mt-1 text-lg font-semibold text-slate-50">
                  {activeZone.name}
                </h3>
                <p className="text-xs text-slate-400">{activeZone.landmark}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-3xl font-bold text-slate-50 tabular-nums">
                  {activeAssessment.score}
                </div>
                <div className="mt-1">
                  <RiskLabel level={activeAssessment.category} />
                </div>
              </div>
            </div>

            {/* Factor Contribution Table */}
            <div className="space-y-2.5 border-t border-[#1E2F4D] pt-4">
              <div className="text-xs font-medium text-slate-300">
                Weighted Factor Contributions (Sum = {activeAssessment.score}/100)
              </div>
              {activeAssessment.factorBreakdown.map((f) => (
                <div
                  key={f.key}
                  className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium">{f.label}</span>
                    <span className="font-mono text-slate-300 tabular-nums">
                      {f.rawValue} × {f.weightPct}% ={' '}
                      <strong className="text-teal-300">+{f.contribution}</strong>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#162238] overflow-hidden">
                    <div
                      className="h-full bg-teal-500"
                      style={{ width: `${f.rawValue}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Understandable Reasons */}
            <div className="space-y-2 border-t border-[#1E2F4D] pt-4">
              <div className="text-xs font-medium text-slate-300">
                Key Reasons Driving This Score
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {activeAssessment.reasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 rounded-md bg-[#0B1424] px-3 py-2 border border-[#1E2F4D]"
                  >
                    <span className="font-mono text-teal-400 shrink-0">
                      0{idx + 1}.
                    </span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Municipal Action */}
            <div className="rounded-md border border-teal-500/30 bg-teal-500/10 p-3.5 text-xs">
              <div className="font-semibold text-teal-300">
                Recommended Municipal Action
              </div>
              <p className="mt-1 text-slate-200 leading-relaxed">
                {activeAssessment.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
