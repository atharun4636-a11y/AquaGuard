import React, { useState } from 'react';
import {
  Building2,
  Droplets,
  ShieldCheck,
  User,
  ArrowRight,
  MapPin,
  Info,
} from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import { UserRole } from '../types/aquaguard';

interface RoleOption {
  role: UserRole;
  title: string;
  subtitle: string;
  permissions: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: UserRole.ADMIN,
    title: 'Municipal Admin',
    subtitle: 'City-wide governance, datasets & risk factor configuration',
    permissions: [
      'Configure AI risk factor weights & scoring thresholds',
      'Manage municipal officer & citizen demo accounts',
      'Inspect system-wide analytics, datasets & ward risk',
    ],
    icon: ShieldCheck,
  },
  {
    role: UserRole.OFFICER,
    title: 'Municipal Officer',
    subtitle: 'Ward operations, complaint verification & drainage dispatch',
    permissions: [
      'Verify citizen waterlogging reports & update statuses',
      'Assign & track smart drainage desilting tasks',
      'Monitor rainfall intelligence & run scenario simulations',
    ],
    icon: Building2,
  },
  {
    role: UserRole.CITIZEN,
    title: 'Citizen / Public User',
    subtitle: 'Incident reporting with photo upload & local risk alerts',
    permissions: [
      'Submit waterlogging incidents with location & photo',
      'Track verification & crew resolution status live',
      'Check local ward risk levels & public safety advisories',
    ],
    icon: User,
  },
];

export const LoginScreen: React.FC = () => {
  const { users, loginAsRole } = useAquaGuard();
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.OFFICER);

  const matchingUsers = users.filter((u) => u.role === selectedRole && u.active);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const activeDemoUser =
    matchingUsers.find((u) => u.id === selectedUserId) ?? matchingUsers[0];

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    const first = users.find((u) => u.role === role && u.active);
    setSelectedUserId(first?.id ?? '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginAsRole(selectedRole, activeDemoUser?.id);
  };

  return (
    <div className="min-h-screen bg-[#08101E] text-slate-100 flex flex-col justify-between">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-10 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          {/* Left Command Overview */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-teal-500/40 bg-teal-500/15 text-teal-400">
                <Droplets className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  AquaGuard
                </h1>
                <p className="text-xs text-slate-400">
                  Vijayawada Urban Waterlogging Command
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl [text-wrap:balance]">
                Smart Urban Waterlogging Risk Assessment &amp; Management
              </h2>
              <p className="text-sm leading-relaxed text-slate-300">
                Integrated municipal decision-support prototype for Vijayawada,
                Andhra Pradesh. Combines schematic GIS ward risk mapping,
                transparent factor-based scoring, rainfall scenario simulation,
                smart drainage maintenance, and citizen complaint workflows.
              </p>
            </div>

            <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-teal-400">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Prototype Focus · Vijayawada Municipal Basin</span>
              </div>
              <div className="grid grid-cols-3 gap-3 border-t border-[#1E2F4D] pt-3 text-xs">
                <div>
                  <div className="font-mono text-lg font-semibold text-slate-100 tabular-nums">
                    10
                  </div>
                  <div className="text-slate-400">Key Wards</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-semibold text-teal-400 tabular-nums">
                    3
                  </div>
                  <div className="text-slate-400">User Roles</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-semibold text-amber-300 tabular-nums">
                    3
                  </div>
                  <div className="text-slate-400">Rain Scenarios</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-[#1E2F4D] bg-[#0B1526] p-3.5 text-xs text-slate-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
              <span>
                Hackathon prototype mode: uses local demo authentication and
                clearly labeled illustrative/simulated data. No external
                government API or live sensor feed is connected.
              </span>
            </div>
          </div>

          {/* Right Role Selection & Demo Access Panel */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-[#1E2F4D] bg-[#0F192D] p-6 sm:p-7 space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-50">
                  Select Role for Demo Access
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Choose a municipal or citizen persona to enter the corresponding
                  dashboard. Citizen reports sync across Officer and Admin views.
                </p>
              </div>

              <div className="space-y-3" role="radiogroup" aria-label="User role selection">
                {ROLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedRole === option.role;
                  return (
                    <button
                      key={option.role}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleRoleSelect(option.role)}
                      className={`w-full text-left rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                        isSelected
                          ? 'border-teal-500/70 bg-[#14243E]'
                          : 'border-[#1E2F4D] bg-[#0B1424] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                              isSelected
                                ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                                : 'border-[#1E2F4D] bg-[#111E35] text-slate-400'
                            }`}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-100">
                              {option.title}
                            </div>
                            <div className="text-xs text-slate-400">
                              {option.subtitle}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`mt-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                            isSelected ? 'text-teal-400' : 'text-slate-500'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </span>
                      </div>

                      {isSelected && (
                        <ul className="mt-3 space-y-1 border-t border-[#1E2F4D] pt-3 text-xs text-slate-300">
                          {option.permissions.map((perm) => (
                            <li key={perm} className="flex items-center gap-2">
                              <span
                                className="h-1 w-1 rounded-full bg-teal-400 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{perm}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Demo Account Preview */}
              <div className="space-y-3 rounded-lg border border-[#1E2F4D] bg-[#0B1424] p-4">
                <div>
                  <label
                    htmlFor="demo-account-select"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Demo Account Profile
                  </label>
                  <select
                    id="demo-account-select"
                    value={activeDemoUser?.id ?? ''}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0F192D] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
                  >
                    {matchingUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.designation}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 border-t border-[#1E2F4D] pt-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-mono text-teal-300 break-all">
                    {activeDemoUser?.email ?? 'demo@aquaguard.local'}
                  </span>
                  <span className="text-slate-400">
                    {activeDemoUser?.wardScope}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => loginAsRole(UserRole.ADMIN)}
                    className="rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs font-medium text-slate-300 hover:border-teal-500/50 hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    Quick Demo: Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsRole(UserRole.CITIZEN)}
                    className="rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs font-medium text-slate-300 hover:border-teal-500/50 hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    Quick Demo: Citizen
                  </button>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 whitespace-nowrap shrink-0"
                >
                  <span>
                    Enter{' '}
                    {selectedRole === UserRole.ADMIN
                      ? 'Admin'
                      : selectedRole === UserRole.OFFICER
                      ? 'Officer'
                      : 'Citizen'}{' '}
                    Dashboard
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
