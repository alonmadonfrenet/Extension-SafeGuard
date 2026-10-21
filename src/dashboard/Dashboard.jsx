import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, ShieldOff, TrendingUp, AlertTriangle, Activity,
  Cpu, BarChart2, Lock, Eye, EyeOff, AlertCircle, Smartphone,
  Globe, Clock, RefreshCw,
} from 'lucide-react';
import { getSettings, saveSettings, getActivityLog, getProfiles, getActiveProfileId } from '../storage/storageService.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { verifyPassword, is2FAEnabled, verifyTOTP, getAuth } from '../utils/authService.js';

// ── Auth modal ─────────────────────────────────────────────────────────────────
function ToggleAuthModal({ action, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [step, setStep]         = useState('password');
  const [password, setPassword] = useState('');
  const [token, setToken]       = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const pwRef   = useRef(null);
  const totpRef = useRef(null);

  useEffect(() => { setTimeout(() => pwRef.current?.focus(), 80); }, []);
  useEffect(() => { if (step === '2fa') setTimeout(() => totpRef.current?.focus(), 80); }, [step]);

  const handlePassword = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true); setError('');
    try {
      const ok = await verifyPassword(password);
      if (!ok) { setError(t('wrongPassword')); setLoading(false); return; }
      const twoFA = await is2FAEnabled();
      if (twoFA) { setStep('2fa'); setLoading(false); return; }
      onSuccess();
    } catch { setError('Auth error'); setLoading(false); }
  };

  const handleTOTP = async (e) => {
    e.preventDefault();
    if (token.length !== 6) return;
    setLoading(true); setError('');
    try {
      const auth = await getAuth();
      const ok   = await verifyTOTP(auth.totpSecret, token);
      if (ok) { onSuccess(); return; }
      setError(t('invalidCode')); setToken('');
    } catch { setError('2FA error'); }
    setLoading(false);
  };

  const accent = action === 'disable' ? 'var(--color-danger)' : 'var(--color-primary)';
  const accentBg = action === 'disable' ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.12)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="card w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: accentBg }}>
            {step === '2fa' ? <Smartphone size={20} style={{ color: accent }} /> : <Lock size={20} style={{ color: accent }} />}
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--color-text)' }}>{t('authRequired')}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {action === 'disable' ? t('deactivateProtection') : t('activateProtection')}
            </p>
          </div>
        </div>

        {step === 'password' && (
          <form onSubmit={handlePassword} className="space-y-3">
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input ref={pwRef} type={showPw ? 'text' : 'password'} value={password}
                     onChange={e => setPassword(e.target.value)} placeholder={t('parentPassword')}
                     className="input pl-9 pr-9" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm p-2 rounded-lg"
                   style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">{t('cancel')}</button>
              <button type="submit" disabled={loading || !password}
                      className="btn flex-1" style={{ background: accent, color: 'white' }}>
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : t('confirm')}
              </button>
            </div>
          </form>
        )}

        {step === '2fa' && (
          <form onSubmit={handleTOTP} className="space-y-3">
            <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>{t('twoFactorDesc')}</p>
            <input ref={totpRef} type="text" inputMode="numeric" maxLength={6} value={token}
                   onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                   placeholder="000000" className="input text-center text-2xl tracking-widest font-mono" />
            {error && (
              <div className="flex items-center gap-2 text-sm p-2 rounded-lg"
                   style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setStep('password'); setError(''); }} className="btn btn-ghost flex-1">{t('back')}</button>
              <button type="submit" disabled={loading || token.length !== 6}
                      className="btn flex-1" style={{ background: accent, color: 'white' }}>
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : t('verifyCode')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Mini sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#3B82F6', height = 36 }) {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const W = 120;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = height - (v / max) * height * 0.9 - height * 0.05;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const areaBot = height;
  const first = pts.split(' ')[0];
  const last  = pts.split(' ').slice(-1)[0];
  return (
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`${first} ${pts} ${last.split(',')[0]},${areaBot} 0,${areaBot}`}
               fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
      {/* Last value dot */}
      <circle cx={last.split(',')[0]} cy={last.split(',')[1]} r="3" fill={color} />
    </svg>
  );
}

// ── Stat card with sparkline ───────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, sparkData }) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
             style={{ background: `${color}1A` }}>
          <Icon size={20} style={{ color }} />
        </div>
        {sparkData && <Sparkline data={sparkData} color={color} height={36} />}
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{value}</p>
      <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color }}>{sub}</p>}
    </div>
  );
}

// ── Mini bar chart (last 7 days) ───────────────────────────────────────────────
function MiniBarChart({ days }) {
  const maxV = Math.max(...days.map(d => d.visits), 1);
  const W = 280, H = 60;
  const bw = (W / days.length) * 0.35;
  const gap = W / days.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {days.map((d, i) => {
        const vh = (d.visits  / maxV) * (H - 20);
        const bh = (d.blocked / maxV) * (H - 20);
        const x  = i * gap + gap * 0.15;
        return (
          <g key={i}>
            <rect x={x}        y={H - 16 - vh} width={bw} height={Math.max(vh, 1)} fill="#3B82F6" rx="2" opacity="0.8" />
            <rect x={x + bw + 1} y={H - 16 - bh} width={bw} height={Math.max(bh, 1)} fill="#EF4444" rx="2" opacity="0.8" />
            <text x={x + bw}   y={H - 2} textAnchor="middle" fontSize="8" fill="var(--color-text-muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Risk gauge (SVG arc) ───────────────────────────────────────────────────────
function RiskGauge({ score }) {
  const R = 36, CX = 48, CY = 48;
  const angle = (score / 100) * Math.PI;
  const x = CX + R * Math.cos(Math.PI + angle);
  const y = CY + R * Math.sin(Math.PI + angle);
  const color = score < 30 ? '#10B981' : score < 60 ? '#F59E0B' : '#EF4444';
  const bgArc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const fgArc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${x} ${y}`;

  return (
    <svg width={96} height={56} viewBox="0 0 96 56">
      <path d={bgArc} fill="none" stroke="var(--color-border)" strokeWidth="6" strokeLinecap="round" />
      <path d={fgArc} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
      <text x={CX} y={CY - 2}  textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{score}</text>
      <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8"  fill="var(--color-text-muted)">/ 100</text>
    </svg>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardView() {
  const { t } = useTranslation();
  const [protectionEnabled, setProtectionEnabled] = useState(true);
  const [recentActivity, setRecentActivity]       = useState([]);
  const [activeProfile, setActiveProfile]         = useState(null);
  const [authAction, setAuthAction]               = useState(null);
  const [refreshing, setRefreshing]               = useState(false);

  // Computed metrics
  const [metrics, setMetrics] = useState({
    blockedToday: 0, visitedToday: 0, riskScore: 0, bypasses: 0,
    last7Days: [], catBreakdown: [], hourlyPeak: '--',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const settings   = await getSettings();
    setProtectionEnabled(settings.protectionEnabled ?? true);

    const log        = await getActivityLog();
    const profileId  = await getActiveProfileId();
    const profiles   = await getProfiles();
    setActiveProfile(profiles.find(p => p.id === profileId) || null);

    // Today stats
    const today      = new Date().toDateString();
    const todayLog   = log.filter(e => new Date(e.timestamp).toDateString() === today);
    const blockedToday = todayLog.filter(e => e.decision === 'blocked').length;
    const bypasses   = log.filter(e => e.category === 'bypass_attempt').length;

    // Last 7 days bar data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d    = new Date(); d.setDate(d.getDate() - i);
      const key  = d.toDateString();
      const label = d.toLocaleDateString([], { weekday: 'short' });
      const dLog = log.filter(e => new Date(e.timestamp).toDateString() === key);
      last7Days.push({ label, visits: dLog.length, blocked: dLog.filter(e => e.decision === 'blocked').length });
    }

    // Risk score
    const harmful    = log.filter(e =>
      ['violence_category','adult_category','gambling_category','drugs_category','hate_category','bypass_attempt'].includes(e.category)
    ).length;
    const riskScore  = log.length > 0 ? Math.min(100, Math.round((harmful / log.length) * 100 + bypasses * 5)) : 0;

    // Hourly peak
    const hours = new Array(24).fill(0);
    log.forEach(e => hours[new Date(e.timestamp).getHours()]++);
    const peakHour = hours.indexOf(Math.max(...hours));
    const hourlyPeak = hours[peakHour] > 0 ? `${peakHour}h–${peakHour+1}h` : '--';

    // Sparklines (7 days visits)
    const visitSpark   = last7Days.map(d => d.visits);
    const blockedSpark = last7Days.map(d => d.blocked);

    setMetrics({ blockedToday, visitedToday: todayLog.length, riskScore, bypasses, last7Days, hourlyPeak, visitSpark, blockedSpark });
    setRecentActivity(log.slice(0, 6));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAuthSuccess = async () => {
    const newState = !protectionEnabled;
    setProtectionEnabled(newState);
    setAuthAction(null);
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'TOGGLE_PROTECTION' });
    } else {
      const s = await getSettings();
      s.protectionEnabled = newState;
      await saveSettings(s);
    }
    loadData();
  };

  const riskColor = metrics.riskScore < 30 ? '#10B981' : metrics.riskScore < 60 ? '#F59E0B' : '#EF4444';
  const riskLabel = metrics.riskScore < 30 ? t('riskLow') : metrics.riskScore < 60 ? t('riskMedium') : t('riskHigh');

  const CAT_COLORS = {
    safe: '#10B981', educational: '#3B82F6', entertainment: '#8B5CF6',
    news_category: '#6B7280', violence_category: '#EF4444', adult_category: '#EC4899',
    gambling_category: '#F59E0B', drugs_category: '#F97316', hate_category: '#DC2626',
    keyword: '#F97316', manual: '#EF4444', bypass_attempt: '#7C3AED',
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* ── Protection banner ──────────────────────────────────────────────── */}
      <div className="card p-5 flex items-center justify-between"
           style={{ borderLeft: `4px solid ${protectionEnabled ? '#10B981' : '#EF4444'}` }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-13 h-13 rounded-full flex items-center justify-center"
                 style={{
                   background: protectionEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                   width: 52, height: 52,
                 }}>
              {protectionEnabled
                ? <Shield size={26} style={{ color: '#10B981' }} />
                : <ShieldOff size={26} style={{ color: '#EF4444' }} />}
            </div>
            {/* Pulse ring when active */}
            {protectionEnabled && (
              <div className="absolute inset-0 rounded-full animate-pulse-ring"
                   style={{ border: '2px solid rgba(16,185,129,0.4)' }} />
            )}
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
              {protectionEnabled ? t('protectionActive') : t('protectionInactive')}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {activeProfile
                ? `${t('activeProfile')}: ${activeProfile.name} · ${t(activeProfile.ageGroup)}`
                : t('noProfiles')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
                  className="btn btn-ghost p-2">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setAuthAction(protectionEnabled ? 'disable' : 'enable')}
                  className="btn px-4 py-2.5 font-medium flex items-center gap-2"
                  style={{
                    background: protectionEnabled ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    color:      protectionEnabled ? 'var(--color-danger)' : 'var(--color-accent)',
                    border: `1px solid ${protectionEnabled ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  }}>
            <Lock size={13} />
            {protectionEnabled ? t('deactivateProtection') : t('activateProtection')}
          </button>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Activity}      label={t('sitesVisited')}  value={metrics.visitedToday}
                  color="#3B82F6"  sparkData={metrics.visitSpark}
                  sub={`${t('today')}`} />
        <StatCard icon={AlertTriangle} label={t('blockedToday')}  value={metrics.blockedToday}
                  color="#EF4444"  sparkData={metrics.blockedSpark}
                  sub={metrics.blockedToday > 0 ? '⚠️ Active threats' : '✅ All clear'} />
        <StatCard icon={TrendingUp}    label={t('riskLevel')}      value={riskLabel}
                  color={riskColor} sparkData={null}
                  sub={`Score: ${metrics.riskScore}/100`} />
        <StatCard icon={Cpu}           label={t('aiStatus')}       value={t('aiReady')}
                  color="#8B5CF6"  sparkData={null}
                  sub="Multilingual EN·FR·RU" />
      </div>

      {/* ── Middle row: 7-day chart + risk gauge ──────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">

        {/* 7-day bar chart */}
        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              📊 {t('thisWeek')}
            </h3>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#3B82F6' }} />
                {t('sitesVisited')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#EF4444' }} />
                {t('blocked')}
              </span>
            </div>
          </div>
          <MiniBarChart days={metrics.last7Days} />
        </div>

        {/* Risk + peak hour */}
        <div className="card p-5 flex flex-col items-center justify-between">
          <h3 className="font-semibold text-sm self-start" style={{ color: 'var(--color-text)' }}>
            🛡️ {t('riskLevel')}
          </h3>
          <RiskGauge score={metrics.riskScore} />
          <div className="w-full space-y-2 mt-2">
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--color-text-muted)' }}>Bypasses</span>
              <span className="font-bold" style={{ color: metrics.bypasses > 0 ? '#7C3AED' : 'var(--color-text)' }}>
                {metrics.bypasses}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--color-text-muted)' }}>Peak hour</span>
              <span className="font-bold" style={{ color: 'var(--color-text)' }}>{metrics.hourlyPeak}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent activity feed ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b"
             style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <BarChart2 size={16} style={{ color: 'var(--color-primary)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              {t('lastActivity')}
            </h3>
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('today')} · {recentActivity.length} entries
          </span>
        </div>

        {recentActivity.length === 0 ? (
          <div className="p-10 text-center">
            <Activity size={36} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--color-text)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('noActivity')}</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {recentActivity.map(entry => {
              let hostname = entry.url;
              try { hostname = new URL(entry.url).hostname.replace('www.', ''); } catch {}
              const catColor = CAT_COLORS[entry.category] || '#9CA3AF';
              const isRu = entry.url?.includes('.ru') || entry.url?.includes('.рф');
              const conf = entry.confidence ? Math.round(entry.confidence * 100) : null;

              return (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:opacity-80 transition-opacity">
                  {/* Status dot */}
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                       style={{ background: entry.decision === 'blocked' ? '#EF4444' : '#10B981' }} />

                  {/* Favicon */}
                  <img src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
                       alt="" width={14} height={14} className="flex-shrink-0 rounded"
                       onError={e => e.target.style.display = 'none'} />

                  {/* Site info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {entry.title || hostname}
                      </p>
                      {isRu && <span className="text-xs flex-shrink-0">🇷🇺</span>}
                      {entry.profileName && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-primary)' }}>
                          {entry.profileName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{hostname}</p>
                  </div>

                  {/* Category badge */}
                  <span className="badge text-xs flex-shrink-0"
                        style={{ background: `${catColor}18`, color: catColor }}>
                    {entry.category?.replace('_category', '').replace('_', ' ')}
                  </span>

                  {/* Confidence bar */}
                  {conf !== null && conf > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${conf}%`, background: catColor }} />
                      </div>
                      <span className="text-xs font-bold w-7 text-right" style={{ color: catColor }}>{conf}%</span>
                    </div>
                  )}

                  {/* Decision */}
                  <span className="badge text-xs flex-shrink-0" style={{
                    background: entry.decision === 'blocked' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    color:      entry.decision === 'blocked' ? '#EF4444' : '#10B981',
                  }}>
                    {entry.decision === 'blocked' ? '🚫' : '✅'} {t(entry.decision)}
                  </span>

                  {/* Time */}
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auth modal */}
      {authAction && (
        <ToggleAuthModal
          action={authAction}
          onSuccess={handleAuthSuccess}
          onCancel={() => setAuthAction(null)}
        />
      )}
    </div>
  );
}
