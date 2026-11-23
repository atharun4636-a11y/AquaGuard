import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  BrainCircuit,
  CloudRain,
  Database,
  Droplets,
  FilePlus2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map,
  Menu,
  RotateCcw,
  SlidersHorizontal,
  UserCog,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { NavSectionId, useAquaGuard } from '../context/AquaGuardContext';
import { ScenarioType, UserRole } from '../types/aquaguard';

interface NavItem {
  id: NavSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV: NavItem[] = [
  { id: 'overview', label: 'Command Overview', icon: LayoutDashboard },
  { id: 'gis-map', label: 'GIS Risk Map', icon: Map },
  { id: 'rainfall', label: 'Rainfall & Weather', icon: CloudRain },
  { id: 'ai-risk', label: 'AI Risk Scoring', icon: BrainCircuit },
  { id: 'simulator', label: 'Scenario Simulator', icon: SlidersHorizontal },
  { id: 'drainage', label: 'Drainage Maintenance', icon: Wrench },
  { id: 'incidents', label: 'All Incidents', icon: ListChecks },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { id: 'officers', label: 'Officer Management', icon: UserCog },
  { id: 'users', label: 'Accounts & Roles', icon: Users },
  { id: 'datasets', label: 'Datasets & Sources', icon: Database },
];

const OFFICER_NAV: NavItem[] = [
  { id: 'overview', label: 'Operations Overview', icon: LayoutDashboard },
  { id: 'gis-map', label: 'GIS Risk Map', icon: Map },
  { id: 'incidents', label: 'Citizen Complaints', icon: ListChecks },
  { id: 'drainage', label: 'Drainage Maintenance', icon: Wrench },
  { id: 'ai-risk', label: 'AI Risk Assessment', icon: BrainCircuit },
  { id: 'rainfall', label: 'Rainfall & Alerts', icon: CloudRain },
  { id: 'simulator', label: 'Scenario Simulator', icon: SlidersHorizontal },
  { id: 'analytics', label: 'Reports & Trends', icon: BarChart3 },
];

const CITIZEN_NAV: NavItem[] = [
  { id: 'overview', label: 'Citizen Overview', icon: LayoutDashboard },
  { id: 'report-incident', label: 'Report Incident', icon: FilePlus2 },
  { id: 'my-complaints', label: 'Track Complaints', icon: ListChecks },
  { id: 'gis-map', label: 'Vijayawada Risk Map', icon: Map },
  { id: 'public-alerts', label: 'Alerts & Advisories', icon: Bell },
];

export const LayoutShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    currentUser,
    activeNav,
    setActiveNav,
    logout,
    scenario,
    setScenario,
    resetAllDemoData,
  } = useAquaGuard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  if (!currentUser) return null;

  const navItems =
    currentUser.role === UserRole.ADMIN
      ? ADMIN_NAV
      : currentUser.role === UserRole.OFFICER
      ? OFFICER_NAV
      : CITIZEN_NAV;

  const currentNavLabel =
    navItems.find((n) => n.id === activeNav)?.label ?? 'Dashboard';

  const roleDisplayName =
    currentUser.role === UserRole.ADMIN
      ? 'Admin'
      : currentUser.role === UserRole.OFFICER
      ? 'Municipal Officer'
      : 'Citizen';

  const handleNavClick = (id: NavSectionId) => {
    setActiveNav(id);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#0B1324] border-r border-[#1E2F4D]">
      <div>
        <div className="flex h-14 items-center justify-between border-b border-[#1E2F4D] px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-teal-500/40 bg-teal-500/15 text-teal-400">
              <Droplets className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight text-white">
                AquaGuard
              </div>
              <div className="truncate text-[11px] text-slate-400">
                Vijayawada · {roleDisplayName}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-[#142038] hover:text-white lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1 px-3 py-4" aria-label="Primary Sidebar Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/35'
                    : 'text-slate-300 border border-transparent hover:bg-[#131F36] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile & Mobile Scenario in Sidebar Footer */}
      <div className="border-t border-[#1E2F4D] p-3 space-y-3">
        <div className="md:hidden">
          <div className="text-[11px] font-medium text-slate-400 mb-1.5">
            Simulated Rainfall Scenario
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-[#08101E] p-1 border border-[#1E2F4D]">
            {[ScenarioType.NORMAL, ScenarioType.HEAVY, ScenarioType.EXTREME].map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setScenario(sc)}
                className={`rounded px-1.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  scenario === sc
                    ? sc === ScenarioType.EXTREME
                      ? 'bg-rose-600 text-white'
                      : sc === ScenarioType.HEAVY
                      ? 'bg-amber-600 text-white'
                      : 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-200">
              {currentUser.name}
            </div>
            <div className="truncate text-[11px] text-slate-400">
              {currentUser.designation}
            </div>
          </div>
          <button
            type="button"
            onClick={resetAllDemoData}
            title="Reset demo records to initial seed"
            aria-label="Reset demo data"
            className="rounded-md border border-[#1E2F4D] p-1.5 text-slate-400 hover:border-slate-500 hover:text-slate-200 shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            logout();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#243758] bg-[#08101E] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-teal-500/60 hover:text-white transition-colors whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#08101E] text-slate-100 lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: 3 clean zones */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[#1E2F4D] bg-[#0B1324]/95 px-4 backdrop-blur sm:px-6">
          {/* Zone 1: Breadcrumb / Mobile trigger */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md border border-[#1E2F4D] p-1.5 text-slate-300 hover:text-white lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">
                {roleDisplayName}
              </span>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">
                /
              </span>
              <span className="truncate font-semibold text-slate-100">
                {currentNavLabel}
              </span>
            </div>
          </div>

          {/* Zone 2: Scenario Quick Selector */}
          <div
            className="hidden md:flex items-center gap-1 rounded-md border border-[#1E2F4D] bg-[#08101E] p-1"
            role="group"
            aria-label="Simulated rainfall scenario selector"
          >
            {[ScenarioType.NORMAL, ScenarioType.HEAVY, ScenarioType.EXTREME].map(
              (sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setScenario(sc)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    scenario === sc
                      ? sc === ScenarioType.EXTREME
                        ? 'bg-rose-600 text-white'
                        : sc === ScenarioType.HEAVY
                        ? 'bg-amber-600 text-white'
                        : 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sc} Rain
                </button>
              )
            )}
          </div>

          {/* Zone 3: User Profile Menu with Logout */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-2 rounded-md border border-[#243758] bg-[#0F192D] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-teal-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span className="max-w-[130px] truncate">{currentUser.name}</span>
              <span className="hidden sm:inline text-slate-400">· {roleDisplayName}</span>
            </button>

            {profileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-label="User profile menu"
                  className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-3 shadow-xl space-y-3"
                >
                  <div className="border-b border-[#1E2F4D] pb-2.5 text-xs">
                    <div className="font-semibold text-slate-100">
                      {currentUser.name}
                    </div>
                    <div className="text-teal-400 mt-0.5">{roleDisplayName}</div>
                    <div className="font-mono text-[11px] text-slate-400 mt-1 break-all">
                      {currentUser.email}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        resetAllDemoData();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-slate-300 hover:bg-[#16233B] hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reset Demo Data</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
