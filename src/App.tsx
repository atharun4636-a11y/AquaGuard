/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AquaGuardProvider, useAquaGuard } from './context/AquaGuardContext';
import { LoginScreen } from './components/LoginScreen';
import { LayoutShell } from './components/LayoutShell';
import { VijayawadaGisMap } from './components/VijayawadaGisMap';
import { RainfallWeatherView } from './components/RainfallWeatherView';
import { AiRiskAssessmentView } from './components/AiRiskAssessmentView';
import { ScenarioSimulatorView } from './components/ScenarioSimulatorView';
import { DrainageMaintenanceView } from './components/DrainageMaintenanceView';
import { IncidentsWorkflowView } from './components/IncidentsWorkflowView';
import { CitizenPortalView } from './components/CitizenPortalView';
import { AnalyticsReportsView } from './components/AnalyticsReportsView';
import { AdminGovernanceView } from './components/AdminGovernanceView';
import { OfficerManagementView } from './components/OfficerManagementView';
import {
  AdminOverviewDashboard,
  OfficerOverviewDashboard,
} from './components/OverviewDashboards';
import { UserRole } from './types/aquaguard';
import { canAccessNav } from './utils/permissions';

const AquaGuardWorkspace: React.FC = () => {
  const { currentUser, activeNav } = useAquaGuard();

  if (!currentUser) {
    return <LoginScreen />;
  }

  const renderSection = () => {
    const safeNav = canAccessNav(currentUser.role, activeNav)
      ? activeNav
      : 'overview';

    if (safeNav === 'gis-map') return <VijayawadaGisMap />;
    if (safeNav === 'rainfall') return <RainfallWeatherView />;
    if (safeNav === 'ai-risk') return <AiRiskAssessmentView />;
    if (safeNav === 'simulator') return <ScenarioSimulatorView />;
    if (safeNav === 'drainage') return <DrainageMaintenanceView />;
    if (safeNav === 'incidents') return <IncidentsWorkflowView />;
    if (safeNav === 'analytics') return <AnalyticsReportsView />;
    if (safeNav === 'officers') return <OfficerManagementView />;
    if (safeNav === 'users') return <AdminGovernanceView mode="users" />;
    if (safeNav === 'datasets') return <AdminGovernanceView mode="datasets" />;
    if (safeNav === 'report-incident') return <CitizenPortalView mode="report" />;
    if (safeNav === 'my-complaints') return <CitizenPortalView mode="complaints" />;
    if (safeNav === 'public-alerts') return <CitizenPortalView mode="alerts" />;

    // Default 'overview' per role
    if (currentUser.role === UserRole.ADMIN) {
      return <AdminOverviewDashboard />;
    }
    if (currentUser.role === UserRole.OFFICER) {
      return <OfficerOverviewDashboard />;
    }
    return <CitizenPortalView mode="overview" />;
  };

  return <LayoutShell>{renderSection()}</LayoutShell>;
};

export default function App() {
  return (
    <AquaGuardProvider>
      <AquaGuardWorkspace />
    </AquaGuardProvider>
  );
}
