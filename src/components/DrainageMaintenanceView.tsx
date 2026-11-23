import React, { useMemo, useState } from 'react';
import { Plus, Wrench, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import {
  DrainCondition,
  MaintenanceStatus,
  UserRole,
} from '../types/aquaguard';
import { computeDrainPriorityScore } from '../utils/riskEngine';
import {
  DrainConditionText,
  KpiCard,
  MaintenanceStatusBadge,
  RiskLabel,
  SectionHeader,
} from './UiPrimitives';

export const DrainageMaintenanceView: React.FC = () => {
  const {
    currentUser,
    assignedWardIdsForCurrentOfficer,
    drains,
    tasks,
    zoneAssessments,
    createMaintenanceTask,
    updateTaskStatus,
    updateDrainCondition,
  } = useAquaGuard();

  const isOfficer = currentUser?.role === UserRole.OFFICER;
  const canManage =
    currentUser?.role === UserRole.OFFICER || currentUser?.role === UserRole.ADMIN;

  const scopedDrains = useMemo(() => {
    if (!isOfficer) return drains;
    const wardSet = new Set(assignedWardIdsForCurrentOfficer);
    return drains.filter((d) => wardSet.has(d.wardId));
  }, [drains, isOfficer, assignedWardIdsForCurrentOfficer]);

  const scopedTasks = useMemo(() => {
    if (!isOfficer) return tasks;
    const wardSet = new Set(assignedWardIdsForCurrentOfficer);
    return tasks.filter((t) => wardSet.has(t.wardId));
  }, [tasks, isOfficer, assignedWardIdsForCurrentOfficer]);

  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | 'ALL'>('ALL');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  const [title, setTitle] = useState('');
  const [assetId, setAssetId] = useState(scopedDrains[0]?.id ?? '');
  const [assignedTeam, setAssignedTeam] = useState('Rapid Pump Unit B-2');
  const [dueDate, setDueDate] = useState('2026-11-24');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const rankedDrains = useMemo(() => {
    return [...scopedDrains]
      .map((d) => {
        const zoneScore = zoneAssessments[d.wardId]?.score ?? 60;
        const priorityScore = computeDrainPriorityScore(d, zoneScore);
        return { drain: d, priorityScore };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [scopedDrains, zoneAssessments]);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'ALL') return scopedTasks;
    return scopedTasks.filter((t) => t.status === statusFilter);
  }, [scopedTasks, statusFilter]);

  const resolvedAssetId = scopedDrains.some((d) => d.id === assetId)
    ? assetId
    : rankedDrains[0]?.drain.id ?? '';

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedAssetId) {
      setFormError('No drainage asset available in your assigned wards.');
      return;
    }
    if (!title.trim() || title.trim().length < 5) {
      setFormError('Please enter a descriptive task title (at least 5 characters).');
      return;
    }
    const res = createMaintenanceTask({
      title,
      assetId: resolvedAssetId,
      assignedTeam,
      dueDate,
      notes: notes || 'Assigned via Smart Drainage Maintenance console.',
    });
    if (!res.ok) {
      setFormError(res.error ?? 'Permission denied for selected asset.');
      return;
    }
    setTitle('');
    setNotes('');
    setFormError('');
    setShowNewTaskForm(false);
  };

  const blockedCount = scopedDrains.filter(
    (d) => d.blockedReported || d.condition === DrainCondition.BLOCKED
  ).length;
  const openTasks = scopedTasks.filter(
    (t) => t.status !== MaintenanceStatus.COMPLETED
  ).length;
  const completedTasks = scopedTasks.filter(
    (t) => t.status === MaintenanceStatus.COMPLETED
  ).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Smart Drainage Maintenance"
        subtitle={
          isOfficer
            ? `Prioritize and manage stormwater assets and maintenance tasks strictly within your assigned wards (${currentUser?.wardScope ?? 'Assigned Wards'}).`
            : 'Prioritize stormwater culverts, canal outfalls, and underpass sumps across all Vijayawada wards.'
        }
        dataTag={
          isOfficer
            ? `Assigned Wards Scope (${scopedDrains.length} Assets) · Live Demo Queue`
            : 'City-Wide Asset Registry & Live Demo Task Queue'
        }
        action={
          canManage && scopedDrains.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowNewTaskForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-500 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{showNewTaskForm ? 'Close Task Form' : 'Assign Maintenance Task'}</span>
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Monitored Drain Assets"
          value={scopedDrains.length}
          detail="Stormwater trunks, culverts & sumps"
          tone="teal"
        />
        <KpiCard
          label="Blocked / Critical Drains"
          value={blockedCount}
          detail="Requires immediate desilting"
          tone="rose"
        />
        <KpiCard
          label="Open Maintenance Tasks"
          value={openTasks}
          detail="Pending, scheduled, or active"
          tone="amber"
        />
        <KpiCard
          label="Completed Tasks"
          value={completedTasks}
          detail="Assets cleared & restored"
          tone="emerald"
        />
      </div>

      {/* Create Maintenance Task Drawer */}
      {showNewTaskForm && canManage && (
        <form
          onSubmit={handleCreateTask}
          className="rounded-lg border border-teal-500/40 bg-[#0F192D] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Create &amp; Assign Drainage Maintenance Task
            </h3>
            <span className="text-xs text-slate-400">
              Priority score calculates automatically from asset condition
            </span>
          </div>

          {formError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="task-title"
                className="block text-xs font-medium text-slate-300"
              >
                Task Title
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. High-pressure jetting at Benz Circle sump"
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="task-asset"
                className="block text-xs font-medium text-slate-300"
              >
                Target Drainage Asset
              </label>
              <select
                id="task-asset"
                value={resolvedAssetId}
                onChange={(e) => setAssetId(e.target.value)}
                disabled={scopedDrains.length === 0}
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none disabled:opacity-50"
              >
                {rankedDrains.map(({ drain, priorityScore }) => (
                  <option key={drain.id} value={drain.id}>
                    {drain.assetCode} — {drain.name} (Priority {priorityScore})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="task-team"
                className="block text-xs font-medium text-slate-300"
              >
                Assigned Field Crew
              </label>
              <select
                id="task-team"
                value={assignedTeam}
                onChange={(e) => setAssignedTeam(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              >
                <option value="Rapid Pump Unit B-2">Rapid Pump Unit B-2</option>
                <option value="Zone-1 Desilting Team">Zone-1 Desilting Team</option>
                <option value="North Zone Heavy Crew">North Zone Heavy Crew</option>
                <option value="Zone-3 Maintenance Squad">Zone-3 Maintenance Squad</option>
                <option value="Riverbank Engineering Crew">Riverbank Engineering Crew</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="task-due"
                className="block text-xs font-medium text-slate-300"
              >
                Target Completion Date
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="task-notes"
              className="block text-xs font-medium text-slate-300"
            >
              Field Instructions
            </label>
            <input
              id="task-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Equipment needed, traffic diversion, or silt disposal instructions"
              className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewTaskForm(false)}
              className="rounded-md border border-[#243758] bg-[#0B1424] px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
            >
              Create Maintenance Task
            </button>
          </div>
        </form>
      )}

      {/* Pending & Active Maintenance Task Queue */}
      <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#1E2F4D] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-teal-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-100">
              Maintenance Task Queue
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', ...Object.values(MaintenanceStatus)] as const).map((st) => (
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
                {st === 'ALL' ? 'All Tasks' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E2F4D] bg-[#0B1424] text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Task ID</th>
                <th className="px-4 py-2.5 font-medium">Maintenance Scope &amp; Asset</th>
                <th className="px-4 py-2.5 font-medium">Crew</th>
                <th className="px-4 py-2.5 font-medium text-right">Priority</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                {canManage && <th className="px-4 py-2.5 font-medium text-right">Update</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2F4D]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 6 : 5}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No maintenance tasks match the selected status filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-[#131F36]">
                    <td className="px-4 py-3 font-mono text-teal-300 whitespace-nowrap">
                      {task.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{task.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {task.assetName} · {task.wardName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      <div>{task.assignedTeam}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Due {task.dueDate}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RiskLabel level={task.priority} score={task.priorityScore} />
                    </td>
                    <td className="px-4 py-3">
                      <MaintenanceStatusBadge status={task.status} />
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <select
                          aria-label={`Update status for ${task.id}`}
                          value={task.status}
                          onChange={(e) =>
                            updateTaskStatus(task.id, e.target.value as MaintenanceStatus)
                          }
                          className="rounded border border-[#243758] bg-[#0B1424] px-2 py-1 text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
                        >
                          {Object.values(MaintenanceStatus).map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drainage Assets & Siltation Priority Registry */}
      <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] overflow-hidden">
        <div className="border-b border-[#1E2F4D] px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Drainage Assets &amp; Computed Priority Ranking
          </h3>
          <span className="text-xs text-slate-400">
            Sorted by condition, siltation % &amp; ward risk
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E2F4D] bg-[#0B1424] text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Asset Name &amp; Ward</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Condition</th>
                <th className="px-4 py-2.5 font-medium text-right">Siltation</th>
                <th className="px-4 py-2.5 font-medium text-right">Priority Score</th>
                {canManage && <th className="px-4 py-2.5 font-medium text-right">Quick Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2F4D]">
              {rankedDrains.map(({ drain, priorityScore }) => (
                <tr key={drain.id} className="hover:bg-[#131F36]">
                  <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                    {drain.assetCode}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100 flex items-center gap-1.5">
                      <span>{drain.name}</span>
                      {drain.blockedReported && (
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-rose-400 shrink-0"
                          aria-label="Blocked report active"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {drain.wardName} · Last serviced {drain.lastMaintained}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {drain.corridorType}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DrainConditionText condition={drain.condition} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                    {drain.siltationPct}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-teal-300 tabular-nums">
                    {priorityScore}/100
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {drain.condition !== DrainCondition.GOOD ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateDrainCondition(drain.id, DrainCondition.GOOD, false)
                          }
                          className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>Mark Cleared</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateDrainCondition(drain.id, DrainCondition.BLOCKED, true)
                          }
                          className="inline-flex items-center gap-1 rounded border border-[#243758] bg-[#0B1424] px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
                        >
                          <span>Flag Blockage</span>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
