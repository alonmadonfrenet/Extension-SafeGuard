import React, { useState, useEffect, useContext } from 'react';
import {
  Lock, Eye, EyeOff, Sun, Moon, Bell,
  Key, Smartphone, CheckCircle, AlertCircle, Info,
} from 'lucide-react';
import { AppContext } from '../context/AppContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import {
  changePassword, setup2FA, enable2FA, disable2FA,
  is2FAEnabled, getOTPAuthURL,
} from '../utils/authService.js';
import { generateQRDataURL } from '../utils/qrcode.js';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-2 px-5 py-4 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        <Icon size={16} style={{ color: 'var(--color-primary)' }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── QR Code display component ────────────────────────────────────────────────
function QRCodeDisplay({ otpUrl, secret }) {
  const [qrSrc, setQrSrc] = useState(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!otpUrl) return;
    let cancelled = false;
    generateQRDataURL(otpUrl, 180)
      .then(dataUrl => {
        if (cancelled) return;
        if (dataUrl) setQrSrc(dataUrl);
        else setQrError(true);
      })
      .catch(e => {
        if (!cancelled) {
          console.error('[QR]', e);
          setQrError(true);
        }
      });
    return () => { cancelled = true; };
  }, [otpUrl]);

  return (
    <div className="text-center space-y-3">
      {/* QR image */}
      <div
        className="inline-flex items-center justify-center rounded-2xl p-3 mx-auto"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
      >
        {qrSrc && !qrError ? (
          <img src={qrSrc} alt="QR Code" width={180} height={180}
               style={{ display: 'block', imageRendering: 'pixelated' }} />
        ) : (
          <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 rounded-xl"
               style={{ background: '#f5f5f5', border: '2px dashed #ccc' }}>
            <Smartphone size={32} color="#999" />
            <p className="text-xs text-center text-gray-400 px-2">
              {qrError ? 'QR generation failed — use the key below' : 'Generating QR…'}
            </p>
          </div>
        )}
      </div>

      {/* Manual key */}
      <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Manual entry key (TOTP):
        </p>
        <p
          className="font-mono text-sm font-bold break-all select-all"
          style={{ color: 'var(--color-text)' }}
        >
          {secret}
        </p>
      </div>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Use Google Authenticator, Authy, or any TOTP-compatible app
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsView() {
  const { t } = useTranslation();
  const { lang, setLang, theme, setTheme, settings, updateSettings } = useContext(AppContext);

  // Password change state
  const [pwForm, setPwForm]     = useState({ current: '', new: '', confirm: '' });
  const [showPw, setShowPw]     = useState(false);
  const [pwError, setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled]   = useState(false);
  const [twoFASetup, setTwoFASetup]       = useState(false);
  const [twoFASecret, setTwoFASecret]     = useState('');
  const [twoFAOtpUrl, setTwoFAOtpUrl]     = useState('');
  const [twoFAToken, setTwoFAToken]       = useState('');
  const [twoFAError, setTwoFAError]       = useState('');
  const [disablePw, setDisablePw]         = useState('');
  const [twoFALoading, setTwoFALoading]   = useState(false);

  useEffect(() => { is2FAEnabled().then(setTwoFAEnabled); }, []);

  // ── Password change ─────────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    setPwError('');
    if (pwForm.new.length < 6)             { setPwError(t('passwordTooShort')); return; }
    if (pwForm.new !== pwForm.confirm)     { setPwError(t('passwordMismatch')); return; }
    setPwLoading(true);
    const ok = await changePassword(pwForm.current, pwForm.new);
    if (ok) {
      setPwSuccess(true);
      setPwForm({ current: '', new: '', confirm: '' });
      setTimeout(() => setPwSuccess(false), 3000);
    } else {
      setPwError(t('wrongPassword'));
    }
    setPwLoading(false);
  };

  // ── 2FA enable ──────────────────────────────────────────────────────────────
  const startSetup2FA = async () => {
    setTwoFALoading(true);
    setTwoFAError('');
    const secret = await setup2FA();
    const url    = getOTPAuthURL(secret);
    setTwoFASecret(secret);
    setTwoFAOtpUrl(url);
    setTwoFASetup(true);
    setTwoFALoading(false);
  };

  const confirmEnable2FA = async () => {
    if (twoFAToken.length !== 6) return;
    setTwoFALoading(true);
    const ok = await enable2FA(twoFAToken);
    if (ok) {
      setTwoFAEnabled(true);
      setTwoFASetup(false);
      setTwoFAToken('');
      setTwoFAOtpUrl('');
      setTwoFASecret('');
    } else {
      setTwoFAError(t('invalidCode'));
    }
    setTwoFALoading(false);
  };

  // ── 2FA disable ─────────────────────────────────────────────────────────────
  const handleDisable2FA = async () => {
    if (!disablePw) return;
    setTwoFALoading(true);
    const ok = await disable2FA(disablePw);
    if (ok) { setTwoFAEnabled(false); setDisablePw(''); setTwoFAError(''); }
    else     { setTwoFAError(t('wrongPassword')); }
    setTwoFALoading(false);
  };

  const handleNotifToggle = async (key) => {
    await updateSettings({ [key]: !settings[key] });
  };

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{t('settings')}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          SafeGuard v1.0.0 — Parental Control Extension
        </p>
      </div>

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <Section title={`${t('theme')} & ${t('language')}`} icon={Sun}>
        <div className="space-y-4">

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              {t('theme')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'light', label: t('lightMode'), icon: Sun  },
                { value: 'dark',  label: t('darkMode'),  icon: Moon },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className="flex items-center gap-2 p-3 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: theme === value ? 'var(--color-primary)' : 'var(--color-border)',
                    background:  theme === value ? 'rgba(37,99,235,0.07)' : 'transparent',
                    color: 'var(--color-text)',
                  }}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{label}</span>
                  {theme === value && (
                    <CheckCircle size={14} className="ml-auto" style={{ color: 'var(--color-primary)' }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              {t('language')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className="flex flex-col items-center p-3 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: lang === l.code ? 'var(--color-primary)' : 'var(--color-border)',
                    background:  lang === l.code ? 'rgba(37,99,235,0.07)' : 'transparent',
                  }}
                >
                  <span className="text-xl mb-1">{l.flag}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{l.label}</span>
                  {lang === l.code && (
                    <CheckCircle size={12} className="mt-1" style={{ color: 'var(--color-primary)' }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Notifications ──────────────────────────────────────────────────── */}
      <Section title={t('notifications')} icon={Bell}>
        <div className="space-y-3">
          {[
            { key: 'notifyBlocked',  label: t('notifyBlocked')  },
            { key: 'notifyAttempts', label: t('notifyAttempts') },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text)' }}>{label}</span>
              <label className="toggle">
                <input type="checkbox" checked={!!settings[key]} onChange={() => handleNotifToggle(key)} />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Change Password ─────────────────────────────────────────────────── */}
      <Section title={t('changePassword')} icon={Lock}>
        <div className="space-y-3">
          {[
            { field: 'current', label: t('currentPassword') },
            { field: 'new',     label: t('newPassword')     },
            { field: 'confirm', label: t('confirmPassword') },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                {label}
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pwForm[field]}
                  onChange={e => setPwForm({ ...pwForm, [field]: e.target.value })}
                  className="input pr-9"
                />
                {field === 'current' && (
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {pwError && (
            <div className="flex items-center gap-2 text-sm p-2 rounded-lg"
                 style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
              <AlertCircle size={13} /> {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 text-sm p-2 rounded-lg"
                 style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-accent)' }}>
              <CheckCircle size={13} /> {t('passwordChanged')}
            </div>
          )}

          <button onClick={handlePasswordChange} disabled={pwLoading} className="btn btn-primary w-full">
            {pwLoading
              ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : t('changePassword')
            }
          </button>
        </div>
      </Section>

      {/* ── Two-Factor Authentication ───────────────────────────────────────── */}
      <Section title={t('twoFactor')} icon={Smartphone}>

        {/* Already enabled */}
        {twoFAEnabled && !twoFASetup && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl"
                 style={{ background: 'rgba(16,185,129,0.1)' }}>
              <CheckCircle size={20} style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{t('twoFactorEnabled')}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Your account is protected with TOTP</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                {t('currentPassword')} (to disable)
              </label>
              <input
                type="password"
                value={disablePw}
                onChange={e => setDisablePw(e.target.value)}
                placeholder={t('enterPassword')}
                className="input"
              />
            </div>
            {twoFAError && (
              <div className="flex items-center gap-2 text-sm p-2 rounded-lg"
                   style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                <AlertCircle size={13} /> {twoFAError}
              </div>
            )}
            <button
              onClick={handleDisable2FA}
              disabled={twoFALoading || !disablePw}
              className="btn btn-danger w-full"
            >
              {twoFALoading
                ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : t('disable2FA')
              }
            </button>
          </div>
        )}

        {/* Setup flow: show QR + verify */}
        {twoFASetup && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-center" style={{ color: 'var(--color-text)' }}>
              {t('twoFactorSetup')}
            </p>

            {/* Real QR code */}
            <QRCodeDisplay otpUrl={twoFAOtpUrl} secret={twoFASecret} />

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                {t('twoFactorCode')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={twoFAToken}
                onChange={e => setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
            </div>

            {twoFAError && (
              <div className="flex items-center gap-2 text-sm p-2 rounded-lg"
                   style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                <AlertCircle size={13} /> {twoFAError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setTwoFASetup(false); setTwoFAToken(''); setTwoFAError(''); }}
                className="btn btn-ghost flex-1"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmEnable2FA}
                disabled={twoFALoading || twoFAToken.length !== 6}
                className="btn btn-primary flex-1"
              >
                {twoFALoading
                  ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : t('verifyCode')
                }
              </button>
            </div>
          </div>
        )}

        {/* Not yet enabled, not in setup */}
        {!twoFAEnabled && !twoFASetup && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Add an extra layer of security with a TOTP authenticator app
              (Google Authenticator, Authy, Microsoft Authenticator, etc.)
            </p>
            <button onClick={startSetup2FA} disabled={twoFALoading} className="btn btn-primary w-full gap-2">
              {twoFALoading
                ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Key size={15} /> {t('enable2FA')}</>
              }
            </button>
          </div>
        )}
      </Section>

      {/* ── About ──────────────────────────────────────────────────────────── */}
      <Section title={t('about')} icon={Info}>
        <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {[
            [t('version'), '1.0.0'],
            ['Architecture', 'Manifest V3'],
            ['AI Engine', 'TF.js + Heuristic'],
            ['Data Storage', 'Local only'],
            ['2FA', 'TOTP (RFC 6238)'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{k}</span>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{v}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
