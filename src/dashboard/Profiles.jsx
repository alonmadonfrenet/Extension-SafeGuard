import React, { useState, useEffect, useContext } from 'react';
import {
  Users, Plus, Edit2, Trash2, CheckCircle, Shield,
  Clock, BarChart2, Filter, Star, AlertTriangle,
  ChevronRight, Lock, Eye, EyeOff,
} from 'lucide-react';
import {
  getProfiles, saveProfiles, getActiveProfileId, setActiveProfile,
  saveFilters, getFilters, getActivityLog, getSettings,
} from '../storage/storageService.js';
import { RESTRICTION_PRESETS } from '../storage/storageService.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { AppContext } from '../context/AppContext.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────
const AVATARS = ['👧','👦','🧒','👩','👨','🧑','👼','🐣','🦁','🐼','🐨','🦊','⭐','🚀','🎮','🎨'];

const PALETTE = [
  '#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444',
  '#EC4899','#06B6D4','#F97316','#6366F1','#14B8A6',
];

const AGE_DEFAULTS = {
  child:    { color: '#3B82F6', avatar: '👧', label: '6–12' },
  teenager: { color: '#8B5CF6', avatar: '🧑', label: '13–17' },
  adult:    { color: '#10B981', avatar: '👨', label: '18+' },
};

// ── Per-profile stats from activity log ───────────────────────────────────────
function useProfileStats(profiles, log) {
  const stats = {};
  for (const p of profiles) {
    const pLog = log.filter(e => e.profileId === p.id || e.profileName === p.name);
    const today = new Date().toDateString();
    const todayLog = pLog.filter(e => new Date(e.timestamp).toDateString() === today);
    stats[p.id] = {
      total:        pLog.length,
      blocked:      pLog.filter(e => e.decision === 'blocked').length,
      todayVisits:  todayLog.length,
      todayBlocked: todayLog.filter(e => e.decision === 'blocked').length,
      bypasses:     pLog.filter(e => e.category === 'bypass_attempt').length,
      lastSeen:     pLog[0]?.timestamp || null,
    };
  }
  return stats;
}

// ── Avatar picker ─────────────────────────────────────────────────────────────
function AvatarPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {AVATARS.map(a => (
        <button key={a} type="button" onClick={() => onChange(a)}
                className="text-xl p-1.5 rounded-lg transition-all"
                style={{
                  background: value === a ? 'rgba(37,99,235,0.15)' : 'transparent',
                  border: value === a ? '2px solid var(--color-primary)' : '2px solid transparent',
                }}>
          {a}
        </button>
      ))}
    </div>
  );
}

// ── Color picker ──────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PALETTE.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{
                  background: c,
                  outline: value === c ? `3px solid ${c}` : 'none',
                  outlineOffset: 2,
                }} />
      ))}
    </div>
  );
}

// ── Profile stat badge ────────────────────────────────────────────────────────
function StatBadge({ icon: Icon, value, color, label }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl"
         style={{ background: `${color}12` }}>
      <Icon size={13} style={{ color }} className="mb-0.5" />
      <span className="text-sm font-bold leading-tight" style={{ color }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
    </div>
  );
}

// ── Schedule row (time range toggle) ─────────────────────────────────────────
function ScheduleRow({ day, range, onChange }) {
  const { t } = useTranslation();
  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const [enabled, setEnabled] = useState(!!range);
  const [from, setFrom] = useState(range?.from || '06:00');
  const [to,   setTo]   = useState(range?.to   || '22:00');

  const update = (e, f, tt) => {
    if (e) onChange({ from: f, to: tt });
    else   onChange(null);
  };

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-8 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {DAY_LABELS[day]}
      </span>
      <label className="toggle" style={{ transform: 'scale(0.85)' }}>
        <input type="checkbox" checked={enabled} onChange={e => {
          setEnabled(e.target.checked);
          update(e.target.checked, from, to);
        }} />
        <span className="toggle-slider" />
      </label>
      {enabled && (
        <>
          <input type="time" value={from}
                 onChange={e => { setFrom(e.target.value); update(true, e.target.value, to); }}
                 className="input text-xs py-1 px-2 w-24" />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>→</span>
          <input type="time" value={to}
                 onChange={e => { setTo(e.target.value); update(true, from, e.target.value); }}
                 className="input text-xs py-1 px-2 w-24" />
        </>
      )}
      {!enabled && (
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('disabled')}
        </span>
      )}
    </div>
  );
}

// ── Profile form modal ────────────────────────────────────────────────────────
function ProfileModal({ profile, onSave, onClose }) {
  const { t } = useTranslation();
  const isEdit = !!profile;

  const [form, setForm] = useState({
    name:     profile?.name     || '',
    ageGroup: profile?.ageGroup || 'child',
    avatar:   profile?.avatar   || AGE_DEFAULTS['child'].avatar,
    color:    profile?.color    || AGE_DEFAULTS['child'].color,
    schedule: profile?.schedule || null, // { 0: {from,to}, ... } keyed by weekday
  });
  const [tab, setTab]     = useState('basic'); // 'basic' | 'schedule' | 'filters'
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(null);

  // Load existing filters if editing
  useEffect(() => {
    if (profile?.id) {
      getFilters(profile.id).then(setFilters);
    } else {
      const preset = RESTRICTION_PRESETS[form.ageGroup] || RESTRICTION_PRESETS.child;
      setFilters({
        blockedKeywords: [], blockedDomains: [], allowedDomains: [],
        categories: preset.categories, aiThreshold: preset.aiThreshold,
      });
    }
  }, []);

  // Auto-update avatar/color when ageGroup changes (only on create)
  const handleAgeChange = (g) => {
    setForm(prev => ({
      ...prev, ageGroup: g,
      avatar: isEdit ? prev.avatar : AGE_DEFAULTS[g]?.avatar || prev.avatar,
      color:  isEdit ? prev.color  : AGE_DEFAULTS[g]?.color  || prev.color,
    }));
    if (!isEdit) {
      const preset = RESTRICTION_PRESETS[g] || RESTRICTION_PRESETS.child;
      setFilters(prev => prev ? {
        ...prev,
        categories: preset.categories,
        aiThreshold: preset.aiThreshold,
      } : null);
    }
  };

  const handleScheduleDay = (day, range) => {
    setForm(prev => {
      const sched = { ...(prev.schedule || {}) };
      if (range) sched[day] = range;
      else delete sched[day];
      return { ...prev, schedule: Object.keys(sched).length > 0 ? sched : null };
    });
  };

  const handleSave = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    await onSave(form, filters);
    setSaving(false);
    onClose();
  };

  const TABS = [
    { id: 'basic',    label: t('profile'),   icon: '👤' },
    { id: 'schedule', label: 'Schedule',     icon: '🕐' },
    { id: 'filters',  label: t('filters'),   icon: '🔧' },
  ];

  const CATEGORIES = [
    { key: 'violence',    emoji: '⚔️',  label: t('violence')      },
    { key: 'adult_content', emoji: '🔞', label: t('adult_content') },
    { key: 'gambling',    emoji: '🎰',  label: t('gambling')      },
    { key: 'drugs',       emoji: '💊',  label: t('drugs')         },
    { key: 'hate_speech', emoji: '🚫',  label: t('hate_speech')   },
    { key: 'social_media',emoji: '📱',  label: t('social_media')  },
    { key: 'gaming',      emoji: '🎮',  label: t('gaming')        },
    { key: 'news',        emoji: '📰',  label: t('news')          },
    { key: 'education',   emoji: '📚',  label: t('education')     },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
             style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                 style={{ background: `${form.color}20` }}>
              {form.avatar}
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                {isEdit ? t('editProfile') : t('createProfile')}
              </h3>
              {form.name && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{form.name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-2 text-lg leading-none"
                  style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0">
          {TABS.map(tab_ => (
            <button key={tab_.id} onClick={() => setTab(tab_.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-all"
                    style={{
                      borderColor: tab === tab_.id ? 'var(--color-primary)' : 'transparent',
                      color: tab === tab_.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      background: tab === tab_.id ? 'rgba(37,99,235,0.05)' : 'transparent',
                    }}>
              <span>{tab_.icon}</span> {tab_.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── BASIC TAB ──────────────────────────────────────────────── */}
          {tab === 'basic' && (
            <>
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                  {t('profileName')} *
                </label>
                <input type="text" value={form.name}
                       onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                       placeholder="Emma, Alex, Lucas..."
                       className="input" autoFocus />
                {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>}
              </div>

              {/* Age group */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  {t('ageGroup')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['child','teenager','adult'].map(g => {
                    const def = AGE_DEFAULTS[g];
                    return (
                      <button key={g} type="button" onClick={() => handleAgeChange(g)}
                              className="p-3 rounded-xl border-2 text-center transition-all"
                              style={{
                                borderColor: form.ageGroup === g ? def.color : 'var(--color-border)',
                                background:  form.ageGroup === g ? `${def.color}12` : 'transparent',
                              }}>
                        <div className="text-2xl mb-1">{def.avatar}</div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{t(g)}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{def.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Avatar picker */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  Avatar
                </label>
                <AvatarPicker value={form.avatar} onChange={a => setForm(p => ({ ...p, avatar: a }))} />
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  Profile color
                </label>
                <ColorPicker value={form.color} onChange={c => setForm(p => ({ ...p, color: c }))} />
              </div>
            </>
          )}

          {/* ── SCHEDULE TAB ───────────────────────────────────────────── */}
          {tab === 'schedule' && (
            <>
              <div className="p-3 rounded-xl mb-2" style={{ background: 'rgba(37,99,235,0.07)' }}>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                  🕐 Screen time schedule
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Define allowed browsing hours per day. Outside these hours, all web access is blocked.
                  Leave a day disabled for unrestricted access that day.
                </p>
              </div>
              <div className="card p-4 space-y-0.5">
                {[0,1,2,3,4,5,6].map(day => (
                  <ScheduleRow
                    key={day}
                    day={day}
                    range={form.schedule?.[day] || null}
                    onChange={range => handleScheduleDay(day, range)}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── FILTERS TAB ────────────────────────────────────────────── */}
          {tab === 'filters' && filters && (
            <>
              {/* AI threshold */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {t('aiThreshold')}
                  </label>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                    {Math.round((filters.aiThreshold || 0.75) * 100)}%
                  </span>
                </div>
                <input type="range" min="0.4" max="0.95" step="0.05"
                       value={filters.aiThreshold || 0.75}
                       onChange={e => setFilters(f => ({ ...f, aiThreshold: parseFloat(e.target.value) }))}
                       className="w-full" style={{ accentColor: 'var(--color-primary)' }} />
                <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  <span>Permissive (40%)</span><span>Strict (95%)</span>
                </div>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  {t('contentCategories')}
                </label>
                <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {CATEGORIES.map(({ key, emoji, label }) => {
                    const blocked = filters.categories?.[key]?.blocked ?? false;
                    return (
                      <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-lg">{emoji}</span>
                        <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>{label}</span>
                        <label className="toggle" style={{ transform: 'scale(0.85)' }}>
                          <input type="checkbox" checked={blocked}
                                 onChange={() => setFilters(f => ({
                                   ...f,
                                   categories: { ...f.categories, [key]: { blocked: !blocked } }
                                 }))} />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-ghost flex-1">{t('cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
            {saving
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              : <>{t('save')} {form.name && `"${form.name}"`}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Profile card ──────────────────────────────────────────────────────────────
function ProfileCard({ profile, isActive, stats, onSetActive, onEdit, onDelete }) {
  const { t } = useTranslation();
  const color  = profile.color  || AGE_DEFAULTS[profile.ageGroup]?.color || '#3B82F6';
  const avatar = profile.avatar || AGE_DEFAULTS[profile.ageGroup]?.avatar || '👤';

  const riskScore = stats.total > 0
    ? Math.min(100, Math.round((stats.blocked / stats.total) * 100 + stats.bypasses * 5))
    : 0;
  const riskColor = riskScore < 20 ? '#10B981' : riskScore < 50 ? '#F59E0B' : '#EF4444';

  const lastSeen = stats.lastSeen
    ? new Date(stats.lastSeen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div className="card overflow-hidden transition-all hover:shadow-md"
         style={{ borderTop: `3px solid ${color}` }}>

      {/* Card header */}
      <div className="p-5 flex items-start gap-4">
        {/* Avatar circle */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
               style={{ background: `${color}1A` }}>
            {avatar}
          </div>
          {isActive && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                 style={{ background: '#10B981', border: '2px solid var(--color-surface)' }}>
              <CheckCircle size={11} color="white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
              {profile.name}
            </h3>
            {isActive && (
              <span className="badge text-xs" style={{ background: `${color}1A`, color }}>
                ● {t('active')}
              </span>
            )}
            {profile.schedule && (
              <span className="badge text-xs" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-primary)' }}>
                🕐 Scheduled
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {t(profile.ageGroup)} · {AGE_DEFAULTS[profile.ageGroup]?.label}
          </p>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <Clock size={10} /> Last seen: {lastSeen}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(profile)}
                  className="btn btn-ghost p-2" title={t('editProfile')}>
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(profile.id)}
                  className="btn p-2" title={t('deleteProfile')}
                  style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 pb-4 flex gap-2">
        <StatBadge icon={BarChart2}    value={stats.total}        color={color}     label="Total" />
        <StatBadge icon={Shield}       value={stats.blocked}      color="#EF4444"   label="Blocked" />
        <StatBadge icon={AlertTriangle}value={stats.bypasses}     color="#7C3AED"   label="Bypasses" />
        <StatBadge icon={BarChart2}    value={stats.todayVisits}  color="#6B7280"   label="Today" />
        <div className="flex-1" />
        {/* Risk badge */}
        <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl"
             style={{ background: `${riskColor}12` }}>
          <span className="text-sm font-bold" style={{ color: riskColor }}>{riskScore}</span>
          <span className="text-xs" style={{ color: riskColor }}>risk</span>
        </div>
      </div>

      {/* Active switch / set active button */}
      <div className="border-t px-5 py-3 flex items-center justify-between"
           style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
        {isActive ? (
          <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#10B981' }}>
            <CheckCircle size={13} /> {t('activeProfile')} — filtering is active
          </span>
        ) : (
          <button onClick={() => onSetActive(profile.id)}
                  className="btn btn-ghost text-xs gap-1.5 px-3 py-1.5"
                  style={{ color: 'var(--color-primary)' }}>
            <Star size={12} /> {t('setActive')}
          </button>
        )}
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Created {new Date(profile.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function ProfilesView() {
  const { t } = useTranslation();
  const [profiles, setProfiles]   = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [log, setLog]             = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);  // null = create, profile obj = edit
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [profs, aid, actLog] = await Promise.all([
      getProfiles(), getActiveProfileId(), getActivityLog(),
    ]);
    setProfiles(profs);
    setActiveId(aid);
    setLog(actLog);
  };

  const stats = useProfileStats(profiles, log);

  const openCreate = () => { setEditTarget(null); setShowModal(true); };
  const openEdit   = (p)  => { setEditTarget(p);   setShowModal(true); };

  const handleSave = async (formData, filters) => {
    const updated = [...profiles];
    if (editTarget) {
      // Edit existing
      const idx = updated.findIndex(p => p.id === editTarget.id);
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], ...formData, updatedAt: new Date().toISOString() };
      }
      if (filters) await saveFilters(editTarget.id, filters);
    } else {
      // Create new
      const id = `profile_${Date.now()}`;
      const newProfile = {
        id,
        name:      formData.name,
        ageGroup:  formData.ageGroup,
        avatar:    formData.avatar,
        color:     formData.color,
        schedule:  formData.schedule,
        createdAt: new Date().toISOString(),
      };
      if (filters) await saveFilters(id, filters);
      updated.push(newProfile);
    }
    await saveProfiles(updated);
    setProfiles(updated);
  };

  const handleDelete = async (id) => {
    const updated = profiles.filter(p => p.id !== id);
    await saveProfiles(updated);
    if (activeId === id) {
      const fallback = updated[0]?.id || null;
      await setActiveProfile(fallback);
      setActiveId(fallback);
    }
    setProfiles(updated);
    setDeleteConfirm(null);
  };

  const handleSetActive = async (id) => {
    await setActiveProfile(id);
    setActiveId(id);
  };

  const totalBlocked = Object.values(stats).reduce((s, st) => s + st.blocked, 0);
  const totalBypass  = Object.values(stats).reduce((s, st) => s + st.bypasses, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{t('profiles')}</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {profiles.length} profile{profiles.length !== 1 ? 's' : ''} ·{' '}
            {totalBlocked} blocked total ·{' '}
            {totalBypass > 0 && <span style={{ color: '#7C3AED' }}>{totalBypass} bypass attempts</span>}
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary gap-2">
          <Plus size={15} /> {t('createProfile')}
        </button>
      </div>

      {/* Empty state */}
      {profiles.length === 0 && (
        <div className="card p-14 text-center">
          <div className="text-5xl mb-4">👨‍👧</div>
          <p className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>{t('noProfiles')}</p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Create a profile for each child to start personalised filtering
          </p>
          <button onClick={openCreate} className="btn btn-primary gap-2 mx-auto">
            <Plus size={15} /> {t('createProfile')}
          </button>
        </div>
      )}

      {/* Profile grid */}
      {profiles.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {profiles.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeId}
              stats={stats[profile.id] || { total: 0, blocked: 0, todayVisits: 0, todayBlocked: 0, bypasses: 0, lastSeen: null }}
              onSetActive={handleSetActive}
              onEdit={openEdit}
              onDelete={id => setDeleteConfirm(id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <ProfileModal
          profile={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card w-full max-w-sm p-6 animate-slide-up text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>{t('deleteProfile')}</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
              All filters and settings for this profile will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost flex-1">{t('cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger flex-1">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
