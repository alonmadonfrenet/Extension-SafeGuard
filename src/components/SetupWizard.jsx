import React, { useState, useContext } from 'react';
import { Shield, Lock, User, Filter, CheckCircle, Eye, EyeOff, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { setupPassword } from '../utils/authService.js';
import { saveProfiles, setActiveProfile, saveFilters, markSetupDone, getSettings, saveSettings } from '../storage/storageService.js';
import { RESTRICTION_PRESETS } from '../storage/storageService.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { AppContext } from '../context/AppContext.jsx';

const STEPS = ['welcome', 'password', 'profile', 'filters', 'done'];

export default function SetupWizard({ onComplete }) {
  const { t } = useTranslation();
  const { setAuthenticated } = useContext(AppContext);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    profileName: '',
    ageGroup: 'child',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateStep = () => {
    const newErrors = {};
    if (step === 1) {
      if (formData.password.length < 6) newErrors.password = t('passwordTooShort');
      if (formData.password !== formData.confirmPassword) newErrors.confirm = t('passwordMismatch');
    }
    if (step === 2) {
      if (!formData.profileName.trim()) newErrors.profileName = 'Profile name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    if (step === STEPS.length - 2) await finishSetup();
  };

  const finishSetup = async () => {
    setLoading(true);
    try {
      await setupPassword(formData.password);

      const profileId = `profile_${Date.now()}`;
      const preset = RESTRICTION_PRESETS[formData.ageGroup] || RESTRICTION_PRESETS.child;
      const profile = {
        id: profileId,
        name: formData.profileName || 'Child',
        ageGroup: formData.ageGroup,
        createdAt: new Date().toISOString(),
      };

      await saveProfiles([profile]);
      await setActiveProfile(profileId);
      await saveFilters(profileId, {
        blockedKeywords: [],
        blockedDomains: [],
        allowedDomains: [],
        categories: preset.categories,
        aiThreshold: preset.aiThreshold,
      });
      await markSetupDone();
      setAuthenticated(true);
    } catch (e) {
      console.error('Setup error:', e);
    }
    setLoading(false);
  };

  const stepTitles = [
    t('welcomeTitle'),
    t('step1Title'),
    t('step2Title'),
    t('step3Title'),
    t('step4Title'),
  ];

  const stepDescs = [
    t('welcomeDesc'),
    t('step1Desc'),
    t('step2Desc'),
    t('step3Desc'),
    t('step4Desc'),
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        {step > 0 && step < STEPS.length - 1 && (
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                       style={{
                         background: step >= i ? 'var(--color-primary)' : 'var(--color-border)',
                         color: step >= i ? 'white' : 'var(--color-text-muted)',
                       }}>
                    {step > i ? <CheckCircle size={14} /> : i}
                  </div>
                  {i < 3 && <div className="flex-1 h-0.5 transition-all"
                                  style={{ background: step > i ? 'var(--color-primary)' : 'var(--color-border)', width: 60 }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-8 animate-slide-up">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6"
                   style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}>
                <Shield size={40} color="white" />
              </div>
              <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
                {t('welcomeTitle')}
              </h1>
              <p className="text-base mb-8" style={{ color: 'var(--color-text-muted)' }}>
                {t('welcomeDesc')}
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { icon: Shield, label: 'AI Protection' },
                  { icon: Filter, label: 'Smart Filters' },
                  { icon: Sparkles, label: 'Easy Setup' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="p-4 rounded-xl text-center"
                       style={{ background: 'rgba(37,99,235,0.07)' }}>
                    <Icon size={24} className="mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{label}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleNext} className="btn btn-primary w-full text-base py-3">
                {t('getStarted')} <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Step 1: Password */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(37,99,235,0.1)' }}>
                  <Lock size={20} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{t('step1Title')}</h2>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('step1Desc')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                    {t('parentPassword')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder={t('enterPassword')}
                      className="input pr-9"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-text-muted)' }}>
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                    {t('confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder={t('confirmPassword')}
                    className="input"
                  />
                  {errors.confirm && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.confirm}</p>}
                </div>

                {/* Strength indicator */}
                {formData.password && (
                  <div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${Math.min(100, formData.password.length * 12)}%`,
                        background: formData.password.length < 6 ? 'var(--color-danger)' :
                                    formData.password.length < 10 ? 'var(--color-warning)' : 'var(--color-accent)',
                      }} />
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {formData.password.length < 6 ? 'Weak' : formData.password.length < 10 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Profile */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(37,99,235,0.1)' }}>
                  <User size={20} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{t('step2Title')}</h2>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('step2Desc')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                    {t('profileName')}
                  </label>
                  <input
                    type="text"
                    value={formData.profileName}
                    onChange={e => setFormData({ ...formData, profileName: e.target.value })}
                    placeholder="Ex: Emma, Alex..."
                    className="input"
                  />
                  {errors.profileName && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.profileName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                    {t('ageGroup')}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['child', 'teenager', 'adult'].map(group => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setFormData({ ...formData, ageGroup: group })}
                        className="p-3 rounded-xl border-2 text-center transition-all"
                        style={{
                          borderColor: formData.ageGroup === group ? 'var(--color-primary)' : 'var(--color-border)',
                          background: formData.ageGroup === group ? 'rgba(37,99,235,0.07)' : 'transparent',
                        }}
                      >
                        <div className="text-2xl mb-1">
                          {group === 'child' ? '👧' : group === 'teenager' ? '🧑' : '👨'}
                        </div>
                        <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                          {t(group)}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {group === 'child' ? '6-12' : group === 'teenager' ? '13-17' : '18+'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Filters summary */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(37,99,235,0.1)' }}>
                  <Filter size={20} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{t('step3Title')}</h2>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('step3Desc')}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(37,99,235,0.07)' }}>
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
                  Preset: <strong style={{ color: 'var(--color-primary)' }}>{t(formData.ageGroup)}</strong>
                </p>
                <div className="space-y-2">
                  {Object.entries(RESTRICTION_PRESETS[formData.ageGroup]?.categories || {}).map(([cat, val]) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--color-text-muted)' }} className="capitalize">{cat.replace('_', ' ')}</span>
                      <span className="badge" style={{
                        background: val.blocked ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: val.blocked ? 'var(--color-danger)' : 'var(--color-accent)',
                      }}>
                        {val.blocked ? t('categoryBlocked') : t('categoryAllowed')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                You can customize all filters in the dashboard after setup.
              </p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6"
                   style={{ background: 'rgba(16,185,129,0.15)' }}>
                <CheckCircle size={44} style={{ color: 'var(--color-accent)' }} />
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>{t('step4Title')}</h2>
              <p className="mb-8" style={{ color: 'var(--color-text-muted)' }}>{t('step4Desc')}</p>
              <button
                onClick={onComplete}
                className="btn btn-primary w-full text-base py-3"
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>{t('openDashboard')} <ChevronRight size={18} /></>
                )}
              </button>
            </div>
          )}

          {/* Navigation buttons */}
          {step > 0 && step < STEPS.length - 1 && (
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(step - 1)} className="btn btn-ghost flex-none px-4">
                <ChevronLeft size={16} /> {t('back')}
              </button>
              <button onClick={handleNext} className="btn btn-primary flex-1" disabled={loading}>
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>{step === STEPS.length - 2 ? t('finish') : t('next')} <ChevronRight size={16} /></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
