import React, { useContext, useState } from 'react';
import { Sun, Moon, Globe, Bell, User } from 'lucide-react';
import { AppContext } from '../context/AppContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

export default function Header({ title, activeProfile }) {
  const { theme, setTheme, lang, setLang } = useContext(AppContext);
  const { t } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b" style={{ 
      background: 'var(--color-surface)',
      borderColor: 'var(--color-border)',
    }}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{title}</h1>
        {activeProfile && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="status-dot active" />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('activeProfile')}: <span style={{ color: 'var(--color-accent)' }}>{activeProfile.name}</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="btn btn-ghost gap-2 px-3"
          >
            <Globe size={16} />
            <span className="text-xs font-medium uppercase">{lang}</span>
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg border py-1 min-w-36"
                 style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setLangOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                  style={{ 
                    color: lang === l.code ? 'var(--color-primary)' : 'var(--color-text)',
                    background: lang === l.code ? 'rgba(37,99,235,0.07)' : 'transparent',
                  }}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  {lang === l.code && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn btn-ghost px-3"
          title={theme === 'dark' ? t('lightMode') : t('darkMode')}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
