import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Image as ImageIcon,
  Search,
  Wrench,
} from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import {
  IncidentReport,
  IncidentStatus,
  RiskLevel,
  UserRole,
} from '../types/aquaguard';
import {
  IncidentStatusBadge,
  KpiCard,
  RiskLabel,
  SectionHeader,
} from './UiPrimitives';

export const IncidentsWorkflowView: React.FC = () => {
  const {
    currentUser,
    assignedWardIdsForCurrentOfficer,
    incidents,
    drains,
    updateIncidentStatus,
    createMaintenanceTask,
  } = useAquaGuard();

  const isOfficer = currentUser?.role === UserRole.OFFICER;
  const scopedIncidents = useMemo(() => {
    if (!isOfficer) return incidents;
    const wardSet = new Set(assignedWardIdsForCurrentOfficer);
    return incidents.filter((inc) => wardSet.has(inc.wardId));
  }, [incidents, isOfficer, assignedWardIdsForCurrentOfficer]);

  const scopedDrains = useMemo(() => {
    if (!isOfficer) return drains;
    const wardSet = new Set(assignedWardIdsForCurrentOfficer);
    return drains.filter((d) => wardSet.has(d.wardId));
  }, [drains, isOfficer, assignedWardIdsForCurrentOfficer]);

  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(
    scopedIncidents[0]?.id ?? ''
  );

  const [crewInput, setCrewInput] = useState('Rapid Pump Unit B-2');
  const [notesInput, setNotesInput] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return scopedIncidents.filter((inc) => {
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
      if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          inc.title.toLowerCase().includes(q) ||
          inc.location.toLowerCase().includes(q) ||
          inc.wardName.toLowerCase().includes(q) ||
          inc.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scopedIncidents, statusFilter, severityFilter, query]);

  const activeIncident: IncidentReport | undefined =
    scopedIncidents.find((i) => i.id === selectedId) ?? filtered[0];

  const handleSelectIncident = (inc: IncidentReport) => {
    setSelectedId(inc.id);
    setCrewInput(inc.assignedCrew || 'Rapid Pump Unit B-2');
    setNotesInput(inc.officerNotes || '');
    setActionFeedback(null);
  };

  const handleStatusChange = (status: IncidentStatus) => {
    if (!activeIncident) return;
    const res = updateIncidentStatus(
      activeIncident.id,
      status,
      notesInput.trim() || activeIncident.officerNotes,
      crewInput
    );
    if (!res.ok) {
      setActionFeedback(res.error ?? 'Action not permitted.');
    } else {
      setActionFeedback(null);
    }
  };

  const handleCreateLinkedTask = () => {
    if (!activeIncident) return;
    const matchingDrain =
      scopedDrains.find((d) => d.wardId === activeIncident.wardId) ??
      scopedDrains[0];
    if (!matchingDrain) {
      setActionFeedback('No drainage asset registered in this ward to link.');
      return;
    }
    const res = createMaintenanceTask({
      title: `Resolve ${activeIncident.id}: ${activeIncident.location}`,
      assetId: matchingDrain.id,
      assignedTeam: crewInput,
      dueDate: '2026-11-24',
      notes:
        notesInput.trim() ||
        `Created from citizen report: ${activeIncident.description}`,
      linkedIncidentId: activeIncident.id,
    });
    if (!res.ok) {
      setActionFeedback(res.error ?? 'Could not create maintenance task.');
    } else {
      setActionFeedback(null);
    }
  };

  const pendingCount = scopedIncidents.filter(
    (i) => i.status === IncidentStatus.PENDING
  ).length;
  const activeCount = scopedIncidents.filter(
    (i) =>
      i.status === IncidentStatus.VERIFIED ||
      i.status === IncidentStatus.IN_PROGRESS
  ).length;
  const resolvedCount = scopedIncidents.filter(
    (i) => i.status === IncidentStatus.RESOLVED
  ).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Citizen Complaints & Incident Workflow"
        subtitle={
          isOfficer
            ? `Review, verify, and resolve citizen reports strictly within your assigned jurisdiction (${currentUser?.wardScope ?? 'Assigned Wards'}).`
            : 'Review citizen-submitted waterlogging reports across all Vijayawada wards, verify site conditions, dispatch crews, and track resolution.'
        }
        dataTag={
          isOfficer
            ? `Assigned Wards Only (${currentUser?.wardScope ?? ''}) · Shared Demo Ledger`
            : 'City-Wide Incident Ledger (Synced with Citizen Portal)'
        }
      />

      {actionFeedback && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          {actionFeedback}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={isOfficer ? 'Assigned Ward Incidents' : 'Total Reported Incidents'}
          value={scopedIncidents.length}
          detail={isOfficer ? 'Within your assigned wards' : 'Citizen & officer logs'}
          tone="neutral"
        />
        <KpiCard
          label="Pending Verification"
          value={pendingCount}
          detail="Awaiting officer review"
          tone="amber"
        />
        <KpiCard
          label="Verified / Crew Dispatched"
          value={activeCount}
          detail="Active municipal response"
          tone="teal"
        />
        <KpiCard
          label="Resolved Incidents"
          value={resolvedCount}
          detail="Waterlogging cleared"
          tone="emerald"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', ...Object.values(IncidentStatus)] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-teal-600 text-white'
                  : 'bg-[#08101E] text-slate-300 border border-[#1E2F4D] hover:border-slate-500'
              }`}
            >
              {st === 'ALL' ? 'All Statuses' : st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter incidents by severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as RiskLevel | 'ALL')}
            className="rounded-md border border-[#243758] bg-[#0B1424] px-2.5 py-1.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            {Object.values(RiskLevel).map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl} Severity
              </option>
            ))}
          </select>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ward, street, ID..."
              aria-label="Search incidents"
              className="rounded-md border border-[#243758] bg-[#0B1424] pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left List */}
        <div className="lg:col-span-7 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-8 text-center text-xs text-slate-400">
              No incidents match your current search or filter criteria.
            </div>
          ) : (
            filtered.map((inc) => {
              const isSelected = activeIncident?.id === inc.id;
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => handleSelectIncident(inc)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? 'border-teal-500 bg-[#13223B]'
                      : 'border-[#1E2F4D] bg-[#0F192D] hover:border-slate-500'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-teal-300">{inc.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{inc.wardName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{inc.createdAt}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskLabel level={inc.severity} />
                      <IncidentStatusBadge status={inc.status} />
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">
                    {inc.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {inc.location} · Reported by {inc.reportedBy}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Verification & Action Panel */}
        <div className="lg:col-span-5">
          {activeIncident ? (
            <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4 sticky top-20">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs text-teal-400">
                    {activeIncident.id}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-slate-50">
                    {activeIncident.title}
                  </h3>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {activeIncident.location} · {activeIncident.wardName}
                  </div>
                </div>
                <IncidentStatusBadge status={activeIncident.status} />
              </div>

              <p className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-3 text-xs text-slate-300 leading-relaxed">
                {activeIncident.description}
              </p>

              {/* Citizen Uploaded Photo Preview if present */}
              {activeIncident.photoDataUrl ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-300">
                    Attached Citizen Photograph ({activeIncident.photoName})
                  </div>
                  <img
                    src={activeIncident.photoDataUrl}
                    alt={`Uploaded site evidence for ${activeIncident.title}`}
                    className="h-44 w-full rounded-md border border-[#1E2F4D] object-cover bg-[#08101E]"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-[#243758] bg-[#0B1424] px-3 py-2.5 text-xs text-slate-400">
                  <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>No field photograph attached to this seed record.</span>
                </div>
              )}

              {/* Crew Assignment & Notes */}
              <div className="space-y-3 border-t border-[#1E2F4D] pt-4">
                <div>
                  <label
                    htmlFor="officer-crew"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Assign Field Crew / Pump Unit
                  </label>
                  <select
                    id="officer-crew"
                    value={crewInput}
                    onChange={(e) => setCrewInput(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="Rapid Pump Unit B-2">Rapid Pump Unit B-2</option>
                    <option value="Zone-1 Desilting Team">Zone-1 Desilting Team</option>
                    <option value="North Zone Heavy Crew">North Zone Heavy Crew</option>
                    <option value="Zone-3 Maintenance Squad">Zone-3 Maintenance Squad</option>
                    <option value="Central Ward Sanitation">Central Ward Sanitation</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="officer-notes"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Verification &amp; Field Action Notes
                  </label>
                  <textarea
                    id="officer-notes"
                    rows={2}
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Record site inspection findings or pump deployment details..."
                    className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(IncidentStatus.VERIFIED)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-teal-500/40 bg-teal-500/15 px-3 py-2 text-xs font-medium text-teal-200 hover:bg-teal-500/25"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Verify Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(IncidentStatus.IN_PROGRESS)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/25"
                  >
                    <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Dispatch Crew</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(IncidentStatus.RESOLVED)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Mark Resolved</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateLinkedTask}
                    disabled={Boolean(activeIncident.linkedTaskId)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs font-medium text-slate-200 hover:border-teal-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>
                      {activeIncident.linkedTaskId
                        ? `Linked: ${activeIncident.linkedTaskId}`
                        : 'Create Drain Task'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-6 text-center text-xs text-slate-400">
              Select an incident from the list to inspect details and update status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
