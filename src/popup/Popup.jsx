import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  Shield, ShieldOff, ExternalLink, Cpu, Globe, Sun, Moon,
  ChevronDown, Lock, Eye, EyeOff, Key, AlertCircle, CheckCircle, Smartphone,
} from 'lucide-react';
import { AppProvider, AppContext } from '../context/AppContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import {
  getSettings, saveSettings, getActiveProfileId, getProfiles, getActivityLog,
} from '../storage/storageService.js';
import { verifyPassword, is2FAEnabled, verifyTOTP, getAuth } from '../utils/authService.js';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

// ── Inline auth modal (fits inside the popup 320px width) ─────────────────────
function AuthOverlay({ action, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [step, setStep]         = useState('password'); // 'password' | '2fa'
  const [password, setPassword] = useState('');
  const [token, setToken]       = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const pwRef  = useRef(null);
  const totpRef = useRef(null);

  useEffect(() => { setTimeout(() => pwRef.current?.focus(), 80); }, []);
  useEffect(() => { if (step === '2fa') setTimeout(() => totpRef.current?.focus(), 80); }, [step]);

  const handlePassword = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const ok = await verifyPassword(password);
      if (!ok) { setError(t('wrongPassword')); setLoading(false); return; }
      const twoFA = await is2FAEnabled();
      if (twoFA) { setStep('2fa'); setLoading(false); return; }
      onSuccess();
    } catch { setError('Authentication error'); }
    setLoading(false);
  };

  const handleTOTP = async (e) => {
    e.preventDefault();
    if (token.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const auth = await getAuth();
      const ok   = await verifyTOTP(auth.totpSecret, token);
      if (ok) { onSuccess(); return; }
      setError(t('invalidCode'));
      setToken('');
    } catch { setError('2FA error'); }
    setLoading(false);
  };

  const handleTokenChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setToken(val);
    if (val.length === 6) setTimeout(() => totpRef.current?.closest('form')?.requestSubmit?.(), 80);
  };

  // Describe what is being authenticated
  const actionLabel = action === 'disable'
    ? t('deactivateProtection')
    : t('activateProtection');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="w-full rounded-t-2xl p-5 animate-slide-up"
        style={{ background: 'var(--color-surface)', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}
      >
        {/* Icon + title */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: action === 'disable' ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.12)',
            }}
          >
            {step === '2fa'
              ? <Smartphone size={20} style={{ color: action === 'disable' ? 'var(--color-danger)' : 'var(--color-primary)' }} />
              : <Lock size={20} style={{ color: action === 'disable' ? 'var(--color-danger)' : 'var(--color-primary)' }} />
            }
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
              {t('authRequired')}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {actionLabel}
            </p>
          </div>
        </div>

        {/* Password step */}
        {step === 'password' && (
          <form onSubmit={handlePassword} className="space-y-3">
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
                ref={pwRef}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('parentPassword')}
                className="input pl-8 pr-8 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            {error && (
              <div
                className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
              >
                <AlertCircle size={12} /> {error}
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={onCancel} className="btn btn-ghost flex-1 text-sm py-2">
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !password}
                className="btn btn-primary flex-1 text-sm py-2"
                style={action === 'disable' ? { background: 'var(--color-danger)' } : {}}
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : t('confirm')
                }
              </button>
            </div>
          </form>
        )}

        {/* 2FA step */}
        {step === '2fa' && (
          <form onSubmit={handleTOTP} className="space-y-3">
            <div className="text-center mb-1">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t('twoFactorDesc')}
              </p>
            </div>
            <input
              ref={totpRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={token}
              onChange={handleTokenChange}
              placeholder="000 000"
              className="input text-center text-xl tracking-widest font-mono"
            />
            {error && (
              <div
                className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
              >
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep('password'); setError(''); }} className="btn btn-ghost flex-1 text-sm py-2">
                {t('back')}
              </button>
              <button
                type="submit"
                disabled={loading || token.length !== 6}
                className="btn btn-primary flex-1 text-sm py-2"
                style={action === 'disable' ? { background: 'var(--color-danger)' } : {}}
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : t('verifyCode')
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main popup ─────────────────────────────────────────────────────────────────
function PopupApp() {
  const { t } = useTranslation();
  const { lang, setLang, theme, setTheme } = useContext(AppContext);

  const [status, setStatus]         = useState({ protectionEnabled: true, aiReady: false });
  const [currentTab, setCurrentTab] = useState(null);
  const [profile, setProfile]       = useState(null);
  const [todayStats, setTodayStats] = useState({ blocked: 0, visited: 0 });
  const [loading, setLoading]       = useState(true);
  const [langOpen, setLangOpen]     = useState(false);

  // Auth overlay state: null = hidden, 'disable' | 'enable' = shown
  const [authAction, setAuthAction] = useState(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        setCurrentTab(tab);
      }
      const settings = await getSettings();
      setStatus({ protectionEnabled: settings.protectionEnabled ?? true, aiReady: false });

      const pid      = await getActiveProfileId();
      const profiles = await getProfiles();
      setProfile(profiles.find(p => p.id === pid) || null);

      const log      = await getActivityLog();
      const today    = new Date().toDateString();
      const todayLog = log.filter(e => new Date(e.timestamp).toDateString() === today);
      setTodayStats({
        blocked: todayLog.filter(e => e.decision === 'blocked').length,
        visited: todayLog.length,
      });

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
          if (res) setStatus(prev => ({ ...prev, aiReady: res.aiReady }));
        });
      }
    } catch (_) {}
    setLoading(false);
  };

  const openDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    }
  };

  // Clicking the toggle → always ask for auth
  const handleToggleClick = () => {
    const action = status.protectionEnabled ? 'disable' : 'enable';
    setAuthAction(action);
    setLangOpen(false);
  };

  // After successful auth → actually toggle
  const handleAuthSuccess = async () => {
    setAuthAction(null);
    const newState = !status.protectionEnabled;

    // Update local state immediately
    setStatus(prev => ({ ...prev, protectionEnabled: newState }));

    // Persist via service worker
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'TOGGLE_PROTECTION' }, () => {});
    } else {
      // Standalone fallback
      const s = await getSettings();
      s.protectionEnabled = newState;
      await saveSettings(s);
    }
  };

  const hostname = currentTab?.url
    ? (() => { try { return new URL(currentTab.url).hostname; } catch { return null; } })()
    : null;

  if (loading) {
    return (
      <div className="w-80 h-48 flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-80 relative" style={{ background: 'var(--color-bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
            <Shield size={15} color="white" />
          </div>
          <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>SafeGuard</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Language dropdown */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(v => !v)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <Globe size={12} />
              <span className="uppercase">{lang}</span>
              <ChevronDown size={10} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg border py-1 min-w-32"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs"
                    style={{
                      color:      lang === l.code ? 'var(--color-primary)' : 'var(--color-text)',
                      background: lang === l.code ? 'rgba(37,99,235,0.08)' : 'transparent',
                      fontWeight: lang === l.code ? 600 : 400,
                    }}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                    {lang === l.code && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg"
            style={{ background: 'var(--color-border)', color: 'var(--color-text)' }}
            title={theme === 'dark' ? t('lightMode') : t('darkMode')}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Open dashboard */}
          <button
            onClick={openDashboard}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="p-4 space-y-3" onClick={() => setLangOpen(false)}>

        {/* Protection banner */}
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{
            background: status.protectionEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${status.protectionEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: status.protectionEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }}
          >
            {status.protectionEnabled
              ? <Shield size={20} style={{ color: '#10B981' }} />
              : <ShieldOff size={20} style={{ color: '#EF4444' }} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              {status.protectionEnabled ? t('protectionOn') : t('protectionOff')}
            </p>
            <p className="text-xs truncate flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              {profile
                ? <><span>{profile.avatar || '👤'}</span> {profile.name} · {profile.ageGroup}</>
                : t('noProfiles')
              }
            </p>
          </div>

          {/* Toggle — always triggers auth */}
          <button
            onClick={handleToggleClick}
            className="flex-shrink-0 w-11 h-6 rounded-full transition-all relative"
            style={{
              background: status.protectionEnabled ? 'var(--color-accent)' : 'var(--color-border)',
            }}
            title={t('authRequired')}
          >
            <span
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
              style={{ left: status.protectionEnabled ? 'calc(100% - 1.25rem)' : '0.25rem' }}
            />
            {/* Lock icon overlay */}
            <Lock
              size={9}
              color="white"
              className="absolute"
              style={{
                top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                opacity: 0.7,
              }}
            />
          </button>
        </div>

        {/* Current site */}
        {hostname && (
          <div className="card px-3 py-2.5 flex items-center gap-2">
            <Globe size={13} style={{ color: 'var(--color-text-muted)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('currentSite')}</p>
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{hostname}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center">
            <div className="text-xl font-bold" style={{ color: 'var(--color-danger)' }}>{todayStats.blocked}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{t('blockedToday')}</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{todayStats.visited}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{t('sitesVisited')}</div>
          </div>
        </div>

        {/* AI status */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <Cpu size={14} style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs flex-1" style={{ color: 'var(--color-text-muted)' }}>{t('aiStatus')}</span>
          <span
            className="text-xs font-medium"
            style={{ color: status.aiReady ? 'var(--color-accent)' : 'var(--color-warning)' }}
          >
            {status.aiReady ? t('aiReady') : 'Heuristic'}
          </span>
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: status.aiReady ? 'var(--color-accent)' : 'var(--color-warning)' }}
          />
        </div>

        {/* Open dashboard */}
        <button onClick={openDashboard} className="btn btn-primary w-full gap-2 py-2.5">
          <ExternalLink size={15} />
          {t('openDashboard')}
        </button>
      </div>

      {/* ── Auth overlay (slides up from bottom) ───────────────────── */}
      {authAction && (
        <AuthOverlay
          action={authAction}
          onSuccess={handleAuthSuccess}
          onCancel={() => setAuthAction(null)}
        />
      )}
    </div>
  );
}

export default function PopupRoot() {
  return (
    <AppProvider>
      <PopupApp />
    </AppProvider>
  );
}
