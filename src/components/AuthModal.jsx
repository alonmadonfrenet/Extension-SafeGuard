import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Key, Eye, EyeOff, Smartphone, AlertCircle, CheckCircle } from 'lucide-react';
import { authenticate, is2FAEnabled } from '../utils/authService.js';
import { useTranslation } from '../hooks/useTranslation.js';

const MAX_ATTEMPTS   = 5;
const LOCKOUT_MS     = 30_000;

export default function AuthModal({ onSuccess, onCancel, title, desc }) {
  const { t } = useTranslation();
  const [step, setStep]               = useState('password'); // 'password' | '2fa'
  const [password, setPassword]       = useState('');
  const [totpCode, setTotpCode]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil]     = useState(0);
  const [, forceRender] = useState(0);
  const inputRef = useRef(null);
  const totpRef  = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (step === '2fa') setTimeout(() => totpRef.current?.focus(), 100);
  }, [step]);

  // Countdown ticker while locked out
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

  const isLocked = lockoutUntil > Date.now();

  const handleFailure = (msg) => {
    const newCount = failedAttempts + 1;
    if (newCount >= MAX_ATTEMPTS) {
      setLockoutUntil(Date.now() + LOCKOUT_MS);
      setFailedAttempts(0);
      setPassword('');
      setTotpCode('');
      setError(t('tooManyAttempts') + ` — ${t('tryAgainIn')} ${LOCKOUT_MS / 1000}s`);
    } else {
      setFailedAttempts(newCount);
      const remaining = MAX_ATTEMPTS - newCount;
      setError(`${msg} (${remaining} ${t('attemptsRemaining')})`);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password || isLocked) return;

    const now = Date.now();
    if (lockoutUntil > now) {
      const remainingSecs = Math.ceil((lockoutUntil - now) / 1000);
      setError(t('tooManyAttempts') + ` — ${t('tryAgainIn')} ${remainingSecs}s`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const twoFAEnabled = await is2FAEnabled();
      if (twoFAEnabled) {
        const result = await authenticate(password, null);
        if (result.reason === 'need_2fa') {
          setStep('2fa');
          setFailedAttempts(0); // reset counter on successful password
        } else {
          handleFailure(t('wrongPassword'));
        }
      } else {
        const result = await authenticate(password, null);
        if (result.success) {
          onSuccess();
        } else {
          handleFailure(t('wrongPassword'));
        }
      }
    } catch {
      setError('Authentication error');
    }
    setLoading(false);
  };

  const handleTOTPSubmit = async (e) => {
    e.preventDefault();
    if (totpCode.length !== 6 || isLocked) return;
    setLoading(true);
    setError('');
    try {
      const result = await authenticate(password, totpCode);
      if (result.success) {
        onSuccess();
      } else {
        setTotpCode('');
        handleFailure(t('invalidCode'));
      }
    } catch {
      setError('2FA verification error');
    }
    setLoading(false);
  };

  const handleTOTPChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(val);
    if (val.length === 6) {
      setTimeout(() => totpRef.current?.form?.requestSubmit?.(), 100);
    }
  };

  const lockoutSecs = isLocked ? Math.ceil((lockoutUntil - Date.now()) / 1000) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="card w-full max-w-sm p-6 animate-slide-up">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
               style={{ background: 'rgba(37,99,235,0.1)' }}>
            {step === '2fa' ? (
              <Smartphone size={28} style={{ color: 'var(--color-primary)' }} />
            ) : (
              <Shield size={28} style={{ color: 'var(--color-primary)' }} />
            )}
          </div>
          <h2 className="text-xl font-bold text-center" style={{ color: 'var(--color-text)' }}>
            {title || t('authRequired')}
          </h2>
          <p className="text-sm text-center mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {step === '2fa' ? t('twoFactorDesc') : (desc || t('authDesc'))}
          </p>
        </div>

        {/* Password Step */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                {t('parentPassword')}
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--color-text-muted)' }} />
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('enterPassword')}
                  className="input pl-9 pr-9"
                  disabled={isLocked}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
                   style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              {onCancel && (
                <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
                  {t('cancel')}
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !password || isLocked}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isLocked ? (
                  `${t('locked')} ${lockoutSecs}s`
                ) : (
                  t('unlock')
                )}
              </button>
            </div>
          </form>
        )}

        {/* 2FA Step */}
        {step === '2fa' && (
          <form onSubmit={handleTOTPSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                {t('twoFactorCode')}
              </label>
              <div className="relative">
                <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                     style={{ color: 'var(--color-text-muted)' }} />
                <input
                  ref={totpRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={handleTOTPChange}
                  placeholder="000000"
                  className="input pl-9 text-center text-2xl tracking-widest font-mono"
                  disabled={isLocked}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
                   style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => { setStep('password'); setTotpCode(''); setError(''); }}
                      className="btn btn-ghost flex-1">
                {t('back')}
              </button>
              <button
                type="submit"
                disabled={loading || totpCode.length !== 6 || isLocked}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isLocked ? (
                  `${t('locked')} ${lockoutSecs}s`
                ) : (
                  t('verifyCode')
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
