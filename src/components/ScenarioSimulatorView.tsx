import React, { useMemo } from 'react';
import { CloudLightning, CloudRain, Info, Sun, ArrowUpRight } from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import { RiskLevel, ScenarioType, UserRole } from '../types/aquaguard';
import {
  calculateLocationRiskScore,
  getScenarioModifiers,
} from '../utils/riskEngine';
import { getRiskHexColor, RiskLabel, SectionHeader } from './UiPrimitives';

const SCENARIO_CARDS: {
  type: ScenarioType;
  title: string;
  mmHr: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: ScenarioType.NORMAL,
    title: 'Normal Monsoon',
    mmHr: '14 mm/hr',
    summary: 'Light-to-moderate steady rain handled by routine stormwater drains.',
    icon: Sun,
  },
  {
    type: ScenarioType.HEAVY,
    title: 'Heavy Cloudburst',
    mmHr: '42 mm/hr',
    summary: 'Intense urban spell stressing underpasses and silted culverts.',
    icon: CloudRain,
  },
  {
    type: ScenarioType.EXTREME,
    title: 'Extreme Depression',
    mmHr: '78 mm/hr',
    summary: 'Simulated severe cyclonic event with canal backpressure.',
    icon: CloudLightning,
  },
];

export const ScenarioSimulatorView: React.FC = () => {
  const {
    currentUser,
    assignedWardIdsForCurrentOfficer,
    zones,
    zoneAssessments,
    weights,
    scenario,
    setScenario,
    customRainfallMmHr,
    setCustomRainfallMmHr,
    setActiveNav,
  } = useAquaGuard();

  const isOfficer = currentUser?.role === UserRole.OFFICER;
  const scopedZones = useMemo(() => {
    if (!isOfficer) return zones;
    const wardSet = new Set(assignedWardIdsForCurrentOfficer);
    return zones.filter((z) => wardSet.has(z.id));
  }, [zones, isOfficer, assignedWardIdsForCurrentOfficer]);

  const activeMod = getScenarioModifiers(scenario, customRainfallMmHr);

  const baselineNormal = scopedZones.map((z) => ({
    zone: z,
    normal: calculateLocationRiskScore(z, weights, ScenarioType.NORMAL),
    simulated: zoneAssessments[z.id],
  }));

  const countByLevel = (level: RiskLevel) =>
    baselineNormal.filter((item) => item.simulated.category === level).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="What-If Rainfall Scenario Simulator"
        subtitle={
          isOfficer
            ? `Test how Normal, Heavy, or Extreme rainfall shifts risk across your ${scopedZones.length} assigned Vijayawada wards.`
            : 'Test how Normal, Heavy, or Extreme rainfall scenarios shift illustrative risk scores, ward categories, and map hotspots across Vijayawada.'
        }
        dataTag={
          isOfficer
            ? `Assigned Wards Scope (${scopedZones.length} Wards) · Simulated Scenarios`
            : 'Simulated Scenarios · Not a Hydraulic Flood Prediction'
        }
      />

      <div className="flex items-start gap-2.5 rounded-lg border border-[#1E2F4D] bg-[#0B1424] px-4 py-3 text-xs text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <span className="font-semibold text-slate-100">Simulation Disclaimer: </span>
          Outputs represent <span className="text-amber-300 font-medium">illustrative What-If scenarios</span>{' '}
          based on weighted scoring multipliers. They are designed for preparedness
          planning and do not replace calibrated 2D hydrodynamic flood modeling.
        </div>
      </div>

      {/* Scenario Selector Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {SCENARIO_CARDS.map((card) => {
          const Icon = card.icon;
          const active = scenario === card.type && customRainfallMmHr === undefined;
          return (
            <button
              key={card.type}
              type="button"
              onClick={() => setScenario(card.type)}
              className={`text-left rounded-lg border p-4 transition-colors ${
                active
                  ? 'border-teal-500 bg-[#142540]'
                  : 'border-[#1E2F4D] bg-[#0F192D] hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Icon className="h-4 w-4 text-teal-400" aria-hidden="true" />
                  <span>{card.title}</span>
                </span>
                <span className="font-mono text-xs text-teal-300 tabular-nums">
                  {card.mmHr}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                {card.summary}
              </p>
              <div className="mt-3 text-[11px] font-medium text-teal-400">
                {active ? 'Active Simulation' : 'Apply Scenario'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Rainfall Intensity Fine-Tuning */}
      <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Custom Simulated Rainfall Intensity Override
            </h3>
            <p className="text-xs text-slate-400">
              Slide to test intermediate or extreme intensities; updates all charts and the GIS Risk Map immediately.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-semibold text-teal-300 tabular-nums">
              {activeMod.rainfallMmHr} mm/hr
            </span>
            {customRainfallMmHr !== undefined && (
              <button
                type="button"
                onClick={() => setCustomRainfallMmHr(undefined)}
                className="rounded border border-[#243758] bg-[#0B1424] px-2.5 py-1 text-xs text-slate-300 hover:text-white"
              >
                Use Preset
              </button>
            )}
          </div>
        </div>
        <input
          type="range"
          min={5}
          max={110}
          step={1}
          aria-label="Custom simulated rainfall intensity in mm per hour"
          value={activeMod.rainfallMmHr}
          onChange={(e) => setCustomRainfallMmHr(Number(e.target.value))}
          className="w-full accent-teal-500 cursor-pointer"
        />
        <div className="flex justify-between font-mono text-[11px] text-slate-400">
          <span>5 mm/hr (Light)</span>
          <span>42 mm/hr (Heavy)</span>
          <span>78 mm/hr (Extreme)</span>
          <span>110 mm/hr (Peak Stress)</span>
        </div>
      </div>

      {/* Simulated Distribution + Ward-by-Ward Comparison */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Mini Schematic Map Preview + Distribution */}
        <div className="lg:col-span-5 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              {isOfficer ? 'Assigned Ward Distribution' : 'Simulated Ward Distribution'}
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('gis-map')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300"
            >
              <span>Open Full GIS Map</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { lvl: RiskLevel.LOW, cls: 'text-emerald-400' },
              { lvl: RiskLevel.MEDIUM, cls: 'text-amber-300' },
              { lvl: RiskLevel.HIGH, cls: 'text-orange-400' },
              { lvl: RiskLevel.CRITICAL, cls: 'text-rose-400' },
            ].map((item) => (
              <div
                key={item.lvl}
                className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5"
              >
                <div className={`font-mono text-xl font-bold tabular-nums ${item.cls}`}>
                  {countByLevel(item.lvl)}
                </div>
                <div className="text-[11px] text-slate-400">{item.lvl}</div>
              </div>
            ))}
          </div>

          {/* Live Mini SVG Map Reflecting Scenario */}
          <div className="rounded-md border border-[#1E2F4D] bg-[#070F1C] p-2">
            <svg
              viewBox="0 0 1000 580"
              className="w-full h-auto"
              role="img"
              aria-label="Simulated scenario risk distribution preview across Vijayawada wards"
            >
              <path
                d="M 20,415 C 140,425 230,445 340,468 C 480,498 670,515 980,538 L 980,580 L 20,580 Z"
                fill="#0D2847"
              />
              {scopedZones.map((zone) => {
                const res = zoneAssessments[zone.id];
                const hex = getRiskHexColor(res.category);
                return (
                  <g key={zone.id}>
                    <polygon
                      points={zone.svgPolygon}
                      fill={hex}
                      fillOpacity={0.34}
                      stroke={hex}
                      strokeWidth="2"
                    />
                    <text
                      x={zone.center.x}
                      y={zone.center.y}
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="16"
                      fontWeight="600"
                    >
                      {res.score}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-3 text-xs text-slate-300">
            <span className="font-semibold text-teal-300">Preparedness Advisory: </span>
            {activeMod.advisory}
          </div>
        </div>

        {/* Baseline vs Simulated Comparison Table */}
        <div className="lg:col-span-7 rounded-lg border border-[#1E2F4D] bg-[#0F192D] overflow-hidden">
          <div className="border-b border-[#1E2F4D] px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-100">
              Baseline (Normal) vs. Active Simulated Score ({activeMod.rainfallMmHr} mm/hr)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1E2F4D] bg-[#0B1424] text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ward / Sector</th>
                  <th className="px-4 py-2.5 font-medium text-right">Normal Baseline</th>
                  <th className="px-4 py-2.5 font-medium text-right">Simulated Score</th>
                  <th className="px-4 py-2.5 font-medium text-right">Delta</th>
                  <th className="px-4 py-2.5 font-medium text-right">Simulated Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2F4D]">
                {baselineNormal
                  .sort((a, b) => b.simulated.score - a.simulated.score)
                  .map(({ zone, normal, simulated }) => {
                    const delta = simulated.score - normal.score;
                    return (
                      <tr key={zone.id} className="hover:bg-[#131F36]">
                        <td className="px-4 py-2.5 font-medium text-slate-100">
                          {zone.name}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400 tabular-nums">
                          {normal.score}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-100 tabular-nums">
                          {simulated.score}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          <span
                            className={
                              delta > 15
                                ? 'text-rose-400'
                                : delta > 0
                                ? 'text-amber-300'
                                : 'text-slate-400'
                            }
                          >
                            {delta >= 0 ? `+${delta}` : delta}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <RiskLabel level={simulated.category} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
