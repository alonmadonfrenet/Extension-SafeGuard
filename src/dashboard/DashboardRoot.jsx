import React, { useState, useEffect, useContext } from 'react';
import { AppProvider, AppContext } from '../context/AppContext.jsx';
import AuthModal from '../components/AuthModal.jsx';
import SetupWizard from '../components/SetupWizard.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import DashboardView from './Dashboard.jsx';
import ProfilesView from './Profiles.jsx';
import FiltersView from './Filters.jsx';
import ActivityView from './Activity.jsx';
import AIReportView from './AIReport.jsx';
import SettingsView from './Settings.jsx';
import { isSetupDone, getProfiles, getActiveProfileId } from '../storage/storageService.js';
import { checkSession, hasPassword } from '../utils/authService.js';
import { useTranslation } from '../hooks/useTranslation.js';

const TAB_TITLES = {
  dashboard: 'dashboard',
  profiles: 'profiles',
  filters: 'filters',
  activity: 'activity',
  report: 'aiReport',
  settings: 'settings',
};

function DashboardApp() {
  const { t } = useTranslation();
  const { isAuthenticated, setAuthenticated } = useContext(AppContext);
  const [appState, setAppState] = useState('loading'); // 'loading' | 'setup' | 'auth' | 'app'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeProfile, setActiveProfile] = useState(null);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (isAuthenticated) loadProfile(); }, [isAuthenticated]);

  const init = async () => {
    const setupDone = await isSetupDone();
    if (!setupDone) { setAppState('setup'); return; }

    const sessionOk = await checkSession();
    if (sessionOk) {
      setAuthenticated(true);
      setAppState('app');
    } else {
      setAppState('auth');
    }
  };

  const loadProfile = async () => {
    const pid = await getActiveProfileId();
    const profiles = await getProfiles();
    const prof = profiles.find(p => p.id === pid);
    setActiveProfile(prof || null);
  };

  const handleSetupComplete = () => {
    setAuthenticated(true);
    setAppState('app');
  };

  const handleAuthSuccess = () => {
    setAuthenticated(true);
    setAppState('app');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'profiles': return <ProfilesView />;
      case 'filters': return <FiltersView />;
      case 'activity': return <ActivityView />;
      case 'report': return <AIReportView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView />;
    }
  };

  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"
               style={{ borderWidth: 3 }} />
          <p style={{ color: 'var(--color-text-muted)' }}>{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (appState === 'setup') {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  if (appState === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <AuthModal onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={t(TAB_TITLES[activeTab])} activeProfile={activeProfile} />
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default function DashboardRoot() {
  return (
    <AppProvider>
      <DashboardApp />
    </AppProvider>
  );
}
