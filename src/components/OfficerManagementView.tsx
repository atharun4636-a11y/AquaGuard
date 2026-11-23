import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  MapPin,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserX,
  X,
} from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import { UserRole } from '../types/aquaguard';
import {
  computeOfficerPerformance,
  getUnassignedWards,
} from '../utils/permissions';
import { KpiCard, SectionHeader } from './UiPrimitives';

interface PendingConflict {
  officerId: string;
  wardId: string;
  message: string;
  conflictOfficerName?: string;
}

export const OfficerManagementView: React.FC = () => {
  const {
    users,
    zones,
    incidents,
    drains,
    tasks,
    addDemoUser,
    toggleUserActive,
    assignWardToOfficer,
    unassignWardFromOfficer,
  } = useAquaGuard();

  const officers = useMemo(
    () => users.filter((u) => u.role === UserRole.OFFICER),
    [users]
  );

  const unassignedWards = useMemo(
    () => getUnassignedWards(users, zones),
    [users, zones]
  );

  // Quick-assign state for Unassigned Wards panel
  const [quickAssignTarget, setQuickAssignTarget] = useState<
    Record<string, string>
  >({});

  // Per-officer ward picker state
  const [selectedWardByOfficer, setSelectedWardByOfficer] = useState<
    Record<string, string>
  >({});
  const [conflictBanner, setConflictBanner] = useState<PendingConflict | null>(
    null
  );
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Add New Officer Form State
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDesig, setNewDesig] = useState('Assistant Municipal Engineer');
  const [newWardIds, setNewWardIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  // Map wardId -> primary officer
  const primaryOwnerByWard = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const ofc of officers) {
      for (const wId of ofc.assignedWardIds ?? []) {
        map[wId] = { id: ofc.id, name: ofc.name };
      }
    }
    return map;
  }, [officers]);

  // Map wardId -> backup officers
  const backupOwnersByWard = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    for (const ofc of officers) {
      for (const wId of ofc.backupWardIds ?? []) {
        if (!map[wId]) map[wId] = [];
        map[wId].push({ id: ofc.id, name: ofc.name });
      }
    }
    return map;
  }, [officers]);

  const totalBackupLinks = useMemo(
    () => officers.reduce((sum, o) => sum + (o.backupWardIds?.length ?? 0), 0),
    [officers]
  );

  const handleAssignWard = (
    officerId: string,
    wardId: string,
    options?: { allowReassign?: boolean; asAuthorizedBackup?: boolean }
  ) => {
    setFeedbackBanner(null);
    const res = assignWardToOfficer(officerId, wardId, options);
    if (!res.ok) {
      setConflictBanner({
        officerId,
        wardId,
        message:
          res.error ??
          'Ward assignment blocked due to duplicate assignment rule.',
        conflictOfficerName: res.conflictOfficerName,
      });
      return;
    }

    const ofc = officers.find((o) => o.id === officerId);
    const zone = zones.find((z) => z.id === wardId);
    setConflictBanner(null);
    setFeedbackBanner(
      options?.asAuthorizedBackup
        ? `Authorized backup/shared coverage: Ward ${zone?.wardNumber} (${zone?.name}) added to ${ofc?.name}.`
        : options?.allowReassign
        ? `Reassigned Ward ${zone?.wardNumber} (${zone?.name}) to ${ofc?.name}.`
        : `Assigned Ward ${zone?.wardNumber} (${zone?.name}) to ${ofc?.name}.`
    );
  };

  const handleToggleNewOfficerWard = (wardId: string) => {
    if (primaryOwnerByWard[wardId]) return; // Prevent selecting already-owned ward
    setNewWardIds((prev) =>
      prev.includes(wardId)
        ? prev.filter((id) => id !== wardId)
        : [...prev, wardId]
    );
  };

  const handleCreateOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newDesig.trim()) {
      setFormError('Please enter officer name, email, and designation.');
      return;
    }
    const res = addDemoUser({
      name: newName,
      email: newEmail,
      role: UserRole.OFFICER,
      designation: newDesig,
      wardScope: '',
      assignedWardIds: newWardIds,
    });
    if (!res.ok) {
      setFormError(res.error ?? 'Could not create officer account.');
      return;
    }
    setFeedbackBanner(
      `Added Municipal Officer ${newName.trim()} (${newWardIds.length} assigned wards).`
    );
    setNewName('');
    setNewEmail('');
    setNewDesig('Assistant Municipal Engineer');
    setNewWardIds([]);
    setFormError('');
    setShowAddOfficer(false);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Officer & Ward Assignment Management"
        subtitle="Provision municipal officers, assign exclusive Vijayawada ward jurisdictions, prevent duplicate ordinary ward assignments, and monitor officer-wise performance."
        dataTag="Admin Governance · Shared Demo State"
        action={
          <button
            type="button"
            onClick={() => setShowAddOfficer((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-500 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{showAddOfficer ? 'Close Officer Form' : 'Add Municipal Officer'}</span>
          </button>
        }
      />

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Municipal Officers"
          value={officers.length}
          detail={`${officers.filter((o) => o.active).length} active accounts`}
          tone="teal"
        />
        <KpiCard
          label="Assigned Wards"
          value={`${zones.length - unassignedWards.length} / ${zones.length}`}
          detail="Exclusive primary ward coverage"
          tone="emerald"
        />
        <KpiCard
          label="Unassigned Wards"
          value={unassignedWards.length}
          detail={
            unassignedWards.length > 0
              ? 'Requires officer assignment'
              : 'All Vijayawada wards covered'
          }
          tone={unassignedWards.length > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          label="Backup / Shared Links"
          value={totalBackupLinks}
          detail="Admin-authorized secondary coverage"
          tone="neutral"
        />
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            aria-label="Dismiss notification"
            className="text-emerald-300 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Duplicate Ward Assignment Warning & Explicit Admin Override Banner */}
      {conflictBanner && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/50 bg-rose-950/35 p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-rose-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <div>
                <div className="font-semibold text-rose-100">
                  Duplicate Ordinary Ward Assignment Prevented
                </div>
                <p className="mt-1 leading-relaxed">{conflictBanner.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConflictBanner(null)}
              aria-label="Dismiss warning"
              className="text-rose-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {conflictBanner.conflictOfficerName && (
            <div className="flex flex-wrap items-center gap-2 border-t border-rose-500/30 pt-3">
              <button
                type="button"
                onClick={() =>
                  handleAssignWard(
                    conflictBanner.officerId,
                    conflictBanner.wardId,
                    { allowReassign: true }
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Reassign from {conflictBanner.conflictOfficerName}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAssignWard(
                    conflictBanner.officerId,
                    conflictBanner.wardId,
                    { asAuthorizedBackup: true }
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-teal-500/50 bg-teal-500/15 px-3 py-1.5 text-xs font-medium text-teal-200 hover:bg-teal-500/25 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Authorize Backup / Shared Assignment</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Municipal Officer Form */}
      {showAddOfficer && (
        <form
          onSubmit={handleCreateOfficer}
          className="rounded-lg border border-teal-500/40 bg-[#0F192D] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Add New Municipal Officer &amp; Assign Wards
            </h3>
            <span className="text-xs text-slate-400">
              Already-assigned wards cannot be selected directly
            </span>
          </div>

          {formError && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="new-ofc-name"
                className="block text-xs font-medium text-slate-300"
              >
                Officer Full Name
              </label>
              <input
                id="new-ofc-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Suresh Babu"
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="new-ofc-email"
                className="block text-xs font-medium text-slate-300"
              >
                Municipal Email
              </label>
              <input
                id="new-ofc-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="officer.east@aquaguard-vijayawada.demo"
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="new-ofc-desig"
                className="block text-xs font-medium text-slate-300"
              >
                Designation
              </label>
              <input
                id="new-ofc-desig"
                type="text"
                value={newDesig}
                onChange={(e) => setNewDesig(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-300">
              Select Initial Unassigned Wards (Optional)
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {zones.map((z) => {
                const owner = primaryOwnerByWard[z.id];
                const checked = newWardIds.includes(z.id);
                return (
                  <button
                    key={z.id}
                    type="button"
                    disabled={Boolean(owner)}
                    onClick={() => handleToggleNewOfficerWard(z.id)}
                    className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                      owner
                        ? 'border-[#1E2F4D] bg-[#08101E] text-slate-500 cursor-not-allowed'
                        : checked
                        ? 'border-teal-500 bg-teal-500/15 text-teal-200'
                        : 'border-[#243758] bg-[#0B1424] text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-mono text-[11px]">Ward {z.wardNumber}</div>
                    <div className="truncate font-medium">{z.name}</div>
                    <div className="truncate text-[10px] text-slate-400 mt-0.5">
                      {owner ? `Assigned: ${owner.name}` : 'Unassigned'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddOfficer(false)}
              className="rounded-md border border-[#243758] bg-[#0B1424] px-3.5 py-2 text-xs text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
            >
              Create Officer Account
            </button>
          </div>
        </form>
      )}

      {/* Unassigned Wards Spotlight */}
      <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`h-4 w-4 ${
                unassignedWards.length > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-slate-100">
              Unassigned Wards ({unassignedWards.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Assign unassigned wards directly to an active municipal officer
          </span>
        </div>

        {unassignedWards.length === 0 ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            All {zones.length} monitored Vijayawada wards currently have a primary municipal officer assigned.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {unassignedWards.map((ward) => {
              const targetOfficerId =
                quickAssignTarget[ward.id] ?? officers[0]?.id ?? '';
              return (
                <div
                  key={ward.id}
                  className="flex flex-col gap-3 rounded-md border border-amber-500/35 bg-[#0B1424] p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-amber-300">
                        Ward {ward.wardNumber}
                      </span>
                      <span className="font-semibold text-slate-100 truncate">
                        {ward.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {ward.landmark}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label={`Select officer for Ward ${ward.wardNumber}`}
                      value={targetOfficerId}
                      onChange={(e) =>
                        setQuickAssignTarget((prev) => ({
                          ...prev,
                          [ward.id]: e.target.value,
                        }))
                      }
                      className="rounded border border-[#243758] bg-[#0F192D] px-2.5 py-1.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
                    >
                      {officers.map((ofc) => (
                        <option key={ofc.id} value={ofc.id}>
                          {ofc.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        targetOfficerId &&
                        handleAssignWard(targetOfficerId, ward.id)
                      }
                      className="rounded bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 whitespace-nowrap"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Officer Roster, Assignments & Performance */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Municipal Officers — Assigned Wards &amp; Operational Performance
          </h3>
          <span className="text-xs text-slate-400">
            Ordinary wards are strictly exclusive per officer
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {officers.map((officer) => {
            const perf = computeOfficerPerformance(
              officer,
              incidents,
              drains,
              tasks
            );
            const primaryIds = officer.assignedWardIds ?? [];
            const backupIds = officer.backupWardIds ?? [];
            const defaultWardChoice =
              selectedWardByOfficer[officer.id] ??
              unassignedWards[0]?.id ??
              zones[0]?.id;

            return (
              <div
                key={officer.id}
                className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Officer Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-teal-500/40 bg-teal-500/15 text-teal-300">
                        <UserCog className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-slate-100">
                            {officer.name}
                          </h4>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              officer.active
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {officer.active ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {officer.designation}
                        </div>
                        <div className="font-mono text-[11px] text-teal-400 truncate mt-0.5">
                          {officer.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleUserActive(officer.id)}
                      className="inline-flex items-center gap-1 rounded border border-[#243758] bg-[#0B1424] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-teal-500/60 shrink-0"
                    >
                      {officer.active ? (
                        <>
                          <UserX className="h-3 w-3 text-rose-400" aria-hidden="true" />
                          <span>Suspend</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                          <span>Activate</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Assigned Wards Chips */}
                  <div className="space-y-2 border-t border-[#1E2F4D] pt-3">
                    <div className="text-xs font-medium text-slate-300">
                      Primary Assigned Wards ({primaryIds.length})
                    </div>
                    {primaryIds.length === 0 ? (
                      <div className="text-xs text-slate-500">
                        No primary wards currently assigned.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {primaryIds.map((wId) => {
                          const z = zones.find((item) => item.id === wId);
                          if (!z) return null;
                          return (
                            <span
                              key={wId}
                              className="inline-flex items-center gap-1.5 rounded-md border border-teal-500/40 bg-[#0B1424] px-2.5 py-1 text-xs text-slate-200"
                            >
                              <MapPin className="h-3 w-3 text-teal-400" aria-hidden="true" />
                              <span className="font-mono text-teal-300">
                                W-{z.wardNumber}
                              </span>
                              <span>{z.name}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  unassignWardFromOfficer(officer.id, wId, false)
                                }
                                aria-label={`Unassign Ward ${z.wardNumber} from ${officer.name}`}
                                className="ml-0.5 text-slate-400 hover:text-rose-400"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {backupIds.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <div className="text-[11px] font-medium text-amber-300">
                          Authorized Backup / Shared Coverage ({backupIds.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {backupIds.map((wId) => {
                            const z = zones.find((item) => item.id === wId);
                            if (!z) return null;
                            return (
                              <span
                                key={wId}
                                className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200"
                              >
                                <span className="font-mono">W-{z.wardNumber}</span>
                                <span>{z.name} (Backup)</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    unassignWardFromOfficer(officer.id, wId, true)
                                  }
                                  aria-label={`Remove backup Ward ${z.wardNumber} from ${officer.name}`}
                                  className="ml-0.5 text-amber-300 hover:text-rose-300"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Officer-Wise Incident & Maintenance Performance */}
                  <div className="grid grid-cols-2 gap-2.5 border-t border-[#1E2F4D] pt-3 sm:grid-cols-4">
                    <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5">
                      <div className="text-[11px] text-slate-400">Incidents</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-slate-100 tabular-nums">
                        {perf.totalIncidents}{' '}
                        <span className="text-[11px] font-normal text-amber-300">
                          ({perf.pendingIncidents} open)
                        </span>
                      </div>
                    </div>
                    <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5">
                      <div className="text-[11px] text-slate-400">Resolution</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                        {perf.resolutionRatePct}%{' '}
                        <span className="text-[11px] font-normal text-slate-400">
                          ({perf.resolvedIncidents})
                        </span>
                      </div>
                    </div>
                    <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5">
                      <div className="text-[11px] text-slate-400">Drains</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-slate-100 tabular-nums">
                        {perf.assignedDrainsCount}{' '}
                        <span className="text-[11px] font-normal text-rose-400">
                          ({perf.blockedDrainsCount} blk)
                        </span>
                      </div>
                    </div>
                    <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5">
                      <div className="text-[11px] text-slate-400">Maint. Tasks</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-teal-300 tabular-nums">
                        {perf.openTasksCount} open{' '}
                        <span className="text-[11px] font-normal text-slate-400">
                          / {perf.completedTasksCount} done
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assign Ward Control */}
                <div className="border-t border-[#1E2F4D] pt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    aria-label={`Choose ward to assign to ${officer.name}`}
                    value={defaultWardChoice}
                    onChange={(e) =>
                      setSelectedWardByOfficer((prev) => ({
                        ...prev,
                        [officer.id]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-md border border-[#243758] bg-[#0B1424] px-2.5 py-1.5 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
                  >
                    {zones.map((z) => {
                      const owner = primaryOwnerByWard[z.id];
                      const statusTag = !owner
                        ? 'Unassigned'
                        : owner.id === officer.id
                        ? 'Already Assigned Here'
                        : `Assigned to ${owner.name}`;
                      return (
                        <option key={z.id} value={z.id}>
                          Ward {z.wardNumber} — {z.name} ({statusTag})
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      defaultWardChoice &&
                      handleAssignWard(officer.id, defaultWardChoice)
                    }
                    className="rounded-md bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors whitespace-nowrap shrink-0"
                  >
                    Assign Ward
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* City-Wide Ward Assignment Directory */}
      <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] overflow-hidden">
        <div className="border-b border-[#1E2F4D] px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Vijayawada Ward Coverage Registry (10 Wards)
          </h3>
          <span className="text-xs text-slate-400">
            Shows primary officer, authorized backup, and active workload
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E2F4D] bg-[#0B1424] text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Ward</th>
                <th className="px-4 py-2.5 font-medium">Primary Assigned Officer</th>
                <th className="px-4 py-2.5 font-medium">Authorized Backup</th>
                <th className="px-4 py-2.5 font-medium text-right">Incidents</th>
                <th className="px-4 py-2.5 font-medium text-right">Drains</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2F4D]">
              {zones.map((z) => {
                const owner = primaryOwnerByWard[z.id];
                const backups = backupOwnersByWard[z.id] ?? [];
                const wardIncCount = incidents.filter(
                  (i) => i.wardId === z.id
                ).length;
                const wardDrainCount = drains.filter(
                  (d) => d.wardId === z.id
                ).length;

                return (
                  <tr key={z.id} className="hover:bg-[#131F36]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">
                        Ward {z.wardNumber} · {z.name}
                      </div>
                      <div className="text-[11px] text-slate-400">{z.landmark}</div>
                    </td>
                    <td className="px-4 py-3">
                      {owner ? (
                        <span className="font-medium text-teal-300">
                          {owner.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {backups.length > 0
                        ? backups.map((b) => b.name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                      {wardIncCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                      {wardDrainCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
