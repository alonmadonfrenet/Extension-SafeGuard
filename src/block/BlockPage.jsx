import React, { useState, useEffect } from 'react';
import { ShieldOff, ArrowLeft, Lock, AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { AppProvider } from '../context/AppContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import { verifyPassword } from '../utils/authService.js';
import { addTempAllowed, addActivityEntry } from '../storage/storageService.js';

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;

const CATEGORY_ICONS = {
  schedule:           '🕐',
  violence_category:  '⚔️',
  adult_category:     '🔞',
  gambling_category:  '🎰',
  drugs_category:     '💊',
  hate_category:      '🚫',
  keyword:            '🔤',
  manual:             '🛑',
  default:            '⛔',
};

const CATEGORY_COLORS = {
  schedule:           '#6366F1',
  violence_category:  '#EF4444',
  adult_category:     '#EC4899',
  gambling_category:  '#F59E0B',
  drugs_category:     '#F97316',
  hate_category:      '#DC2626',
  default:            '#EF4444',
};

function BlockPageApp() {
  const { t } = useTranslation();
  const [params, setParams]           = useState({});
  const [showOverride, setShowOverride] = useState(false);
  const [password, setPassword]       = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [unlocked, setUnlocked]       = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil]     = useState(0);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setParams({
      url:         urlParams.get('url')         || '',
      reason:      urlParams.get('reason')      || 'blocked',
      category:    urlParams.get('category')    || 'unknown',
      profile:     urlParams.get('profile')     || '',
      confidence:  parseFloat(urlParams.get('confidence') || '0'),
      explanation: urlParams.get('explanation') || '',
    });
  }, []);

  // Update the lockout countdown every second while active
  useEffect(() => {
    if (!lockoutUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= lockoutUntil) {
        setLockoutUntil(0);
        setError('');
        clearInterval(id);
      } else {
        forceRender(n => n + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutUntil]);

  const handleGoBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = 'about:blank';
  };

  const recordBypassAttempt = (url, title) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'RECORD_BYPASS_ATTEMPT',
        data: { url, title },
      }).catch(() => {});
    }
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    if (!password) return;

    const now = Date.now();
    if (lockoutUntil > now) {
      const remainingSecs = Math.ceil((lockoutUntil - now) / 1000);
      setError(t('tooManyAttempts') + ` — ${t('tryAgainIn')} ${remainingSecs}s`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const valid = await verifyPassword(password);
      if (valid) {
        const hostname = params.url ? new URL(params.url).hostname : '';
        if (hostname) await addTempAllowed(hostname);
        await addActivityEntry({
          url:        params.url,
          title:      `Parent override: ${hostname}`,
          category:   'parent_override',
          decision:   'allowed',
          confidence: 1.0,
          reason:     'parent_override',
        });
        setUnlocked(true);
        setTimeout(() => { window.location.href = params.url; }, 1500);
      } else {
        recordBypassAttempt(params.url, 'Failed override attempt');
        const newCount = failedAttempts + 1;
        if (newCount >= MAX_ATTEMPTS) {
          setLockoutUntil(Date.now() + LOCKOUT_MS);
          setFailedAttempts(0);
          setPassword('');
          setError(t('tooManyAttempts') + ` — ${t('tryAgainIn')} ${LOCKOUT_MS / 1000}s`);
        } else {
          setFailedAttempts(newCount);
          const remaining = MAX_ATTEMPTS - newCount;
          setError(`${t('wrongPassword')} (${remaining} ${t('attemptsRemaining')})`);
        }
      }
    } catch {
      setError('Error verifying password');
    }
    setLoading(false);
  };

  const cat      = params.category || 'default';
  const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
  const catIcon  = CATEGORY_ICONS[cat]  || CATEGORY_ICONS.default;
  const confidence = Math.round((params.confidence || 0) * 100);
  const hostname = params.url
    ? (() => { try { return new URL(params.url).hostname; } catch { return params.url; } })()
    : '';

  const isLocked = lockoutUntil > Date.now();

  if (unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ background: 'rgba(16,185,129,0.15)' }}>
            <CheckCircle size={36} style={{ color: 'var(--color-accent)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Access Granted</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        {/* Main Block Card */}
        <div className="card overflow-hidden mb-4">
          {/* Top Banner */}
          <div className="px-6 py-8 text-center" style={{ background: `${catColor}15` }}>
            <div className="text-5xl mb-3">{catIcon}</div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <ShieldOff size={18} style={{ color: catColor }} />
              <h1 className="text-xl font-bold" style={{ color: catColor }}>
                {t('accessBlocked')}
              </h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('blockedReason')}
            </p>
          </div>

          {/* Details */}
          <div className="p-5 space-y-3">
            {hostname && (
              <div className="flex items-start gap-3">
                <span className="text-sm w-24 flex-shrink-0 font-medium" style={{ color: 'var(--color-text-muted)' }}>Site</span>
                <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{hostname}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm w-24 flex-shrink-0 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {t('blockedCategory')}
              </span>
              <span className="badge text-xs" style={{ background: `${catColor}20`, color: catColor }}>
                {cat.replace('_category', '').replace('_', ' ')}
              </span>
            </div>
            {confidence > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm w-24 flex-shrink-0 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {t('blockedConfidence')}
                </span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="progress-bar flex-1">
                    <div className="progress-fill" style={{ width: `${confidence}%`, background: catColor }} />
                  </div>
                  <span className="text-sm font-bold" style={{ color: catColor }}>{confidence}%</span>
                </div>
              </div>
            )}
            {params.explanation && (
              <div className="p-3 rounded-xl text-xs" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                {params.explanation}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-5 pt-0 flex gap-3">
            <button onClick={handleGoBack} className="btn btn-ghost flex-1 gap-2">
              <ArrowLeft size={15} /> {t('goBack')}
            </button>
            <button
              onClick={() => setShowOverride(!showOverride)}
              className="btn flex-1 gap-2"
              style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-primary)' }}
            >
              <Lock size={15} /> {t('requestAccess')}
            </button>
          </div>
        </div>

        {/* Parent Override */}
        {showOverride && (
          <div className="card p-5 animate-slide-up">
            <h3 className="font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Lock size={15} style={{ color: 'var(--color-primary)' }} />
              {t('parentOverride')}
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {t('enterParentPassword')}
            </p>
            <form onSubmit={handleOverride}>
              <div className="relative mb-3">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('enterPassword')}
                  className="input pr-9"
                  disabled={isLocked}
                  autoFocus
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--color-text-muted)' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-2 rounded-lg mb-3 text-xs"
                     style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                  <AlertTriangle size={13} /> {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !password || isLocked}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isLocked ? (
                  `${t('locked')} — ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s`
                ) : (
                  t('temporaryAllow')
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlockPageRoot() {
  return (
    <AppProvider>
      <BlockPageApp />
    </AppProvider>
  );
}
