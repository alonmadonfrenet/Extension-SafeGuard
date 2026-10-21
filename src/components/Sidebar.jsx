import React, { useContext } from 'react';
import { Shield, LayoutDashboard, Users, Filter, Activity, Settings, LogOut, ChevronRight, Brain } from 'lucide-react';
import { AppContext } from '../context/AppContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import { logout } from '../utils/authService.js';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { id: 'profiles', icon: Users, key: 'profiles' },
  { id: 'filters', icon: Filter, key: 'filters' },
  { id: 'activity', icon: Activity, key: 'activity' },
  { id: 'report',   icon: Brain,    key: 'aiReport'  },
  { id: 'settings', icon: Settings, key: 'settings' },
];

export default function Sidebar({ activeTab, onTabChange }) {
  const { t } = useTranslation();
  const { setAuthenticated } = useContext(AppContext);

  const handleLogout = async () => {
    await logout();
    setAuthenticated(false);
  };

  return (
    <div className="flex flex-col h-full w-64 border-r" style={{ 
      background: 'var(--color-surface)', 
      borderColor: 'var(--color-border)' 
    }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" 
             style={{ background: 'var(--color-primary)' }}>
          <Shield size={20} color="white" />
        </div>
        <div>
          <div className="font-bold text-base leading-tight" style={{ color: 'var(--color-text)' }}>
            SafeGuard
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('appTagline')}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map(({ id, icon: Icon, key }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group"
                style={{
                  background: isActive ? 'rgba(37,99,235,0.1)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{t(key)}</span>
                {isActive && <ChevronRight size={14} />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{ color: 'var(--color-danger)' }}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
        <div className="mt-3 px-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          SafeGuard v1.0.0
        </div>
      </div>
    </div>
  );
}
