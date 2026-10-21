import React, { useState, useEffect } from 'react';
import { Filter, Plus, X, Shield, Cpu, Globe, AlertTriangle } from 'lucide-react';
import { getFilters, saveFilters, getActiveProfileId, getProfiles } from '../storage/storageService.js';
import { useTranslation } from '../hooks/useTranslation.js';

const CATEGORIES = [
  { key: 'violence', label: 'violence', emoji: '⚔️', defaultBlocked: true, severity: 'high' },
  { key: 'adult_content', label: 'adult_content', emoji: '🔞', defaultBlocked: true, severity: 'high' },
  { key: 'gambling', label: 'gambling', emoji: '🎰', defaultBlocked: true, severity: 'high' },
  { key: 'drugs', label: 'drugs', emoji: '💊', defaultBlocked: true, severity: 'high' },
  { key: 'hate_speech', label: 'hate_speech', emoji: '🚫', defaultBlocked: true, severity: 'high' },
  { key: 'social_media', label: 'social_media', emoji: '📱', defaultBlocked: false, severity: 'medium' },
  { key: 'gaming', label: 'gaming', emoji: '🎮', defaultBlocked: false, severity: 'low' },
  { key: 'news', label: 'news', emoji: '📰', defaultBlocked: false, severity: 'low' },
  { key: 'education', label: 'education', emoji: '📚', defaultBlocked: false, severity: 'low' },
];

export default function FiltersView() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [newAllowedDomain, setNewAllowedDomain] = useState('');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('categories');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const pid = await getActiveProfileId();
    setProfileId(pid);
    if (pid) {
      const f = await getFilters(pid);
      setFilters(f);
      const profiles = await getProfiles();
      const prof = profiles.find(p => p.id === pid);
      setProfileName(prof?.name || '');
    }
  };

  const save = async (updated) => {
    if (!profileId) return;
    setFilters(updated);
    await saveFilters(profileId, updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleCategory = (key) => {
    const updated = {
      ...filters,
      categories: {
        ...filters.categories,
        [key]: { blocked: !filters.categories?.[key]?.blocked },
      },
    };
    save(updated);
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    const updated = { ...filters, blockedKeywords: [...(filters.blockedKeywords || []), kw] };
    save(updated);
    setNewKeyword('');
  };

  const removeKeyword = (kw) => {
    const updated = { ...filters, blockedKeywords: filters.blockedKeywords.filter(k => k !== kw) };
    save(updated);
  };

  const addBlockedDomain = () => {
    const d = newBlockedDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!d) return;
    const updated = { ...filters, blockedDomains: [...(filters.blockedDomains || []), d] };
    save(updated);
    setNewBlockedDomain('');
  };

  const removeBlockedDomain = (d) => {
    const updated = { ...filters, blockedDomains: filters.blockedDomains.filter(x => x !== d) };
    save(updated);
  };

  const addAllowedDomain = () => {
    const d = newAllowedDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!d) return;
    const updated = { ...filters, allowedDomains: [...(filters.allowedDomains || []), d] };
    save(updated);
    setNewAllowedDomain('');
  };

  const removeAllowedDomain = (d) => {
    const updated = { ...filters, allowedDomains: filters.allowedDomains.filter(x => x !== d) };
    save(updated);
  };

  const updateThreshold = (val) => {
    save({ ...filters, aiThreshold: parseFloat(val) });
  };

  if (!filters) return (
    <div className="p-6 flex items-center justify-center h-full">
      <p style={{ color: 'var(--color-text-muted)' }}>
        {profileId ? t('loading') : t('noProfiles')}
      </p>
    </div>
  );

  const tabs = ['categories', 'keywords', 'domains', 'ai'];

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{t('contentFiltering')}</h2>
          {profileName && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {t('activeProfile')}: <span style={{ color: 'var(--color-accent)' }}>{profileName}</span>
            </p>
          )}
        </div>
        {saved && (
          <span className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
            ✓ Saved
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-border)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize"
            style={{
              background: activeTab === tab ? 'var(--color-surface)' : 'transparent',
              color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {tab === 'categories' ? t('contentCategories') :
             tab === 'keywords' ? t('blockedKeywords') :
             tab === 'domains' ? t('blockedDomains') :
             'AI'}
          </button>
        ))}
      </div>

      {/* Content Categories */}
      {activeTab === 'categories' && (
        <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {CATEGORIES.map(({ key, label, emoji, severity }) => {
            const isBlocked = filters.categories?.[key]?.blocked ?? false;
            const severityColors = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
            return (
              <div key={key} className="flex items-center gap-4 px-5 py-4">
                <span className="text-2xl">{emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{t(label)}</span>
                    <span className="badge text-xs" style={{
                      background: `${severityColors[severity]}15`,
                      color: severityColors[severity],
                    }}>{severity}</span>
                  </div>
                </div>
                <label className="toggle flex-shrink-0">
                  <input type="checkbox" checked={isBlocked} onChange={() => toggleCategory(key)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            );
          })}
        </div>
      )}

      {/* Keywords */}
      {activeTab === 'keywords' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              placeholder={t('addKeyword')}
              className="input flex-1"
            />
            <button onClick={addKeyword} className="btn btn-primary px-4">
              <Plus size={16} />
            </button>
          </div>
          <div className="card p-4">
            {(filters.blockedKeywords || []).length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                No keywords added yet
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(filters.blockedKeywords || []).map(kw => (
                  <div key={kw} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
                       style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                    <span>{kw}</span>
                    <button onClick={() => removeKeyword(kw)} className="opacity-60 hover:opacity-100">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Domains */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          {/* Blocked Domains */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <AlertTriangle size={15} style={{ color: 'var(--color-danger)' }} />
              {t('blockedDomains')}
            </h4>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newBlockedDomain}
                onChange={e => setNewBlockedDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBlockedDomain()}
                placeholder="example.com"
                className="input flex-1"
              />
              <button onClick={addBlockedDomain} className="btn btn-danger px-4"><Plus size={16} /></button>
            </div>
            <div className="card p-3 min-h-16">
              {(filters.blockedDomains || []).length === 0 ? (
                <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>No blocked domains</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(filters.blockedDomains || []).map(d => (
                    <div key={d} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
                         style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                      <Globe size={12} /><span>{d}</span>
                      <button onClick={() => removeBlockedDomain(d)} className="opacity-60 hover:opacity-100"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Allowed Domains */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Shield size={15} style={{ color: 'var(--color-accent)' }} />
              {t('allowedDomains')}
            </h4>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newAllowedDomain}
                onChange={e => setNewAllowedDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addAllowedDomain()}
                placeholder="trusted-site.com"
                className="input flex-1"
              />
              <button onClick={addAllowedDomain} className="btn px-4"
                      style={{ background: 'var(--color-accent)', color: 'white' }}>
                <Plus size={16} />
              </button>
            </div>
            <div className="card p-3 min-h-16">
              {(filters.allowedDomains || []).length === 0 ? (
                <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>No whitelisted domains</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(filters.allowedDomains || []).map(d => (
                    <div key={d} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
                         style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-accent)' }}>
                      <Globe size={12} /><span>{d}</span>
                      <button onClick={() => removeAllowedDomain(d)} className="opacity-60 hover:opacity-100"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Settings */}
      {activeTab === 'ai' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <Cpu size={20} style={{ color: 'var(--color-primary)' }} />
            <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>AI Classification Settings</h4>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{t('aiThreshold')}</label>
                <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                  {Math.round((filters.aiThreshold || 0.75) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="0.95"
                step="0.05"
                value={filters.aiThreshold || 0.75}
                onChange={e => updateThreshold(e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {t('aiThresholdDesc')}
              </p>
              <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span>Sensitive (40%)</span>
                <span>Strict (95%)</span>
              </div>
            </div>

            <div className="p-4 rounded-xl" style={{ background: 'rgba(37,99,235,0.07)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>How AI classification works</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                SafeGuard analyzes page content using keyword-based heuristics combined with TensorFlow.js toxicity detection. Content is blocked when the confidence score exceeds the threshold above.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
