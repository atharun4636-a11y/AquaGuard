import React, { useState } from 'react';
import { Database, Plus, Shield, UserCheck, UserCog, UserX } from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import { UserRole } from '../types/aquaguard';
import { SectionHeader } from './UiPrimitives';

export const AdminGovernanceView: React.FC<{
  mode: 'users' | 'datasets';
}> = ({ mode }) => {
  const { users, datasets, toggleUserActive, addDemoUser, setActiveNav } = useAquaGuard();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.OFFICER);
  const [designation, setDesignation] = useState('');
  const [wardScope, setWardScope] = useState('Vijayawada Public User');
  const [error, setError] = useState('');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !designation.trim()) {
      setError('Please enter full name, email, and designation.');
      return;
    }
    const res = addDemoUser({
      name,
      email,
      role,
      designation,
      wardScope: role === UserRole.OFFICER ? 'Unassigned' : wardScope,
      assignedWardIds: role === UserRole.OFFICER ? [] : undefined,
    });
    if (!res.ok) {
      setError(res.error ?? 'Failed to add account.');
      return;
    }
    setName('');
    setEmail('');
    setDesignation('');
    setError('');
    setShowAddForm(false);
  };

  if (mode === 'datasets') {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Datasets & Data-Source Registry"
          subtitle="Inventory of spatial, meteorological, scoring, and operational datasets powering the AquaGuard Vijayawada prototype."
          dataTag="Transparent Data Governance"
        />

        <div className="grid gap-4 md:grid-cols-2">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-mono text-teal-400">
                  <Database className="h-4 w-4" aria-hidden="true" />
                  <span>{ds.id}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400">{ds.category}</span>
                </div>
                <span className="text-xs font-medium text-amber-300">
                  {ds.nature}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                {ds.name}
              </h3>
              <div className="space-y-1 text-xs text-slate-300">
                <div>
                  <span className="text-slate-400">Coverage: </span>
                  {ds.coverage}
                </div>
                <div>
                  <span className="text-slate-400">Update Cadence: </span>
                  {ds.updateCadence}
                </div>
              </div>
              <p className="border-t border-[#1E2F4D] pt-2.5 text-xs text-slate-400 leading-relaxed">
                {ds.notes}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Citizen & Municipal Officer Accounts"
        subtitle="Manage demo user accounts and access status. Assign or reassign wards to officers in Officer Management."
        dataTag="Local Demo Directory (No External Auth Server)"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveNav('officers')}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#243758] bg-[#0F192D] px-3.5 py-2 text-xs font-medium text-teal-300 hover:border-teal-500/60 whitespace-nowrap"
            >
              <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Officer Ward Assignments</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-500 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{showAddForm ? 'Close Form' : 'Add Account'}</span>
            </button>
          </div>
        }
      />

      {showAddForm && (
        <form
          onSubmit={handleAddUser}
          className="rounded-lg border border-teal-500/40 bg-[#0F192D] p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-100">
            Provision New Demo Account
          </h3>
          {error && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="usr-name" className="block text-xs font-medium text-slate-300">
                Full Name
              </label>
              <input
                id="usr-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Suresh Babu"
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="usr-email" className="block text-xs font-medium text-slate-300">
                Email Identifier
              </label>
              <input
                id="usr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="suresh@aquaguard-vijayawada.demo"
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="usr-role" className="block text-xs font-medium text-slate-300">
                Role
              </label>
              <select
                id="usr-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              >
                <option value={UserRole.OFFICER}>Municipal Officer</option>
                <option value={UserRole.CITIZEN}>Citizen / Public User</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
            </div>
            <div>
              <label htmlFor="usr-desig" className="block text-xs font-medium text-slate-300">
                Designation
              </label>
              <input
                id="usr-desig"
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Ward Field Inspector"
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="usr-scope" className="block text-xs font-medium text-slate-300">
                Ward / Zone Assignment
              </label>
              <input
                id="usr-scope"
                type="text"
                value={wardScope}
                onChange={(e) => setWardScope(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-md border border-[#243758] bg-[#0B1424] px-3.5 py-2 text-xs text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
            >
              Save Demo Account
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E2F4D] bg-[#0B1424] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role &amp; Designation</th>
                <th className="px-4 py-3 font-medium">Ward Scope</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2F4D]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#131F36]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{user.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 font-medium text-teal-300">
                      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{user.role}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{user.designation}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{user.wardScope}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${
                        user.active ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {user.active ? 'Active' : 'Suspended'}
                    </span>
                    <div className="text-[11px] text-slate-500">{user.lastActive}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleUserActive(user.id)}
                      className="inline-flex items-center gap-1 rounded border border-[#243758] bg-[#0B1424] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-teal-500/60"
                    >
                      {user.active ? (
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
