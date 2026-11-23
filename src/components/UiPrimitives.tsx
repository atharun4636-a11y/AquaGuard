import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  DrainCondition,
  IncidentStatus,
  MaintenanceStatus,
  RiskLevel,
} from '../types/aquaguard';

export function getRiskTextColor(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.LOW:
      return 'text-emerald-400';
    case RiskLevel.MEDIUM:
      return 'text-amber-300';
    case RiskLevel.HIGH:
      return 'text-orange-400';
    case RiskLevel.CRITICAL:
      return 'text-rose-400';
  }
}

export function getRiskSurfaceStyle(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.LOW:
      return 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30';
    case RiskLevel.MEDIUM:
      return 'bg-amber-500/12 text-amber-300 border-amber-500/30';
    case RiskLevel.HIGH:
      return 'bg-orange-500/12 text-orange-300 border-orange-500/30';
    case RiskLevel.CRITICAL:
      return 'bg-rose-500/12 text-rose-300 border-rose-500/30';
  }
}

export function getRiskHexColor(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.LOW:
      return '#16A34A';
    case RiskLevel.MEDIUM:
      return '#EAB308';
    case RiskLevel.HIGH:
      return '#F97316';
    case RiskLevel.CRITICAL:
      return '#EF4444';
  }
}

export const RiskLabel: React.FC<{ level: RiskLevel; score?: number }> = ({
  level,
  score,
}) => {
  const Icon =
    level === RiskLevel.CRITICAL
      ? ShieldAlert
      : level === RiskLevel.HIGH || level === RiskLevel.MEDIUM
      ? AlertTriangle
      : CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${getRiskSurfaceStyle(
        level
      )}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{level}</span>
      {typeof score === 'number' && (
        <span className="font-mono tabular-nums opacity-90">({score})</span>
      )}
    </span>
  );
};

export const IncidentStatusBadge: React.FC<{ status: IncidentStatus }> = ({
  status,
}) => {
  let cls = 'bg-slate-800/80 text-slate-300 border-slate-700';
  let Icon = Clock;

  if (status === IncidentStatus.VERIFIED) {
    cls = 'bg-teal-500/12 text-teal-300 border-teal-500/30';
    Icon = Info;
  } else if (status === IncidentStatus.IN_PROGRESS) {
    cls = 'bg-amber-500/12 text-amber-300 border-amber-500/30';
    Icon = Wrench;
  } else if (status === IncidentStatus.RESOLVED) {
    cls = 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30';
    Icon = CheckCircle2;
  } else if (status === IncidentStatus.PENDING) {
    cls = 'bg-orange-500/12 text-orange-300 border-orange-500/30';
    Icon = Clock;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${cls}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};

export const MaintenanceStatusBadge: React.FC<{ status: MaintenanceStatus }> = ({
  status,
}) => {
  let cls = 'bg-slate-800/80 text-slate-300 border-slate-700';
  if (status === MaintenanceStatus.PENDING) {
    cls = 'bg-rose-500/12 text-rose-300 border-rose-500/30';
  } else if (status === MaintenanceStatus.SCHEDULED) {
    cls = 'bg-teal-500/12 text-teal-300 border-teal-500/30';
  } else if (status === MaintenanceStatus.IN_PROGRESS) {
    cls = 'bg-amber-500/12 text-amber-300 border-amber-500/30';
  } else if (status === MaintenanceStatus.COMPLETED) {
    cls = 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30';
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${cls}`}
    >
      {status}
    </span>
  );
};

export const DrainConditionText: React.FC<{ condition: DrainCondition }> = ({
  condition,
}) => {
  const color =
    condition === DrainCondition.BLOCKED
      ? 'text-rose-400'
      : condition === DrainCondition.POOR
      ? 'text-orange-400'
      : condition === DrainCondition.MODERATE
      ? 'text-amber-300'
      : 'text-emerald-400';

  return <span className={`text-xs font-medium ${color}`}>{condition}</span>;
};

export const SectionHeader: React.FC<{
  title: string;
  subtitle: string;
  dataTag?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, dataTag, action }) => (
  <div className="flex flex-col gap-3 border-b border-[#1E2F4D] pb-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>Vijayawada Municipal Command</span>
        {dataTag && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-teal-400">{dataTag}</span>
          </>
        )}
      </div>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const KpiCard: React.FC<{
  label: string;
  value: string | number;
  detail: string;
  tone?: 'teal' | 'amber' | 'rose' | 'emerald' | 'neutral';
}> = ({ label, value, detail, tone = 'neutral' }) => {
  const accentText =
    tone === 'teal'
      ? 'text-teal-400'
      : tone === 'amber'
      ? 'text-amber-300'
      : tone === 'rose'
      ? 'text-rose-400'
      : tone === 'emerald'
      ? 'text-emerald-400'
      : 'text-slate-100';

  return (
    <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-4">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div
        className={`mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums ${accentText}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-xs text-slate-400">{detail}</div>
    </div>
  );
};
