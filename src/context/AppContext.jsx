import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '../storage/storageService.js';

export const AppContext = createContext({
  lang: 'en',
  theme: 'light',
  settings: {},
  setLang: () => {},
  setTheme: () => {},
  updateSettings: () => {},
  isAuthenticated: false,
  setAuthenticated: () => {},
});

export function AppProvider({ children }) {
  const [lang, setLangState] = useState('en');
  const [theme, setThemeState] = useState('light');
  const [settings, setSettings] = useState({});
  const [isAuthenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setLangState(s.language || 'en');
      const t = s.theme || 'light';
      setThemeState(t);
      applyTheme(t);
    });
  }, []);

  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }

  const setLang = useCallback(async (newLang) => {
    setLangState(newLang);
    const s = await getSettings();
    await saveSettings({ ...s, language: newLang });
    setSettings(prev => ({ ...prev, language: newLang }));
  }, []);

  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    const s = await getSettings();
    await saveSettings({ ...s, theme: newTheme });
    setSettings(prev => ({ ...prev, theme: newTheme }));
  }, []);

  const updateSettings = useCallback(async (updates) => {
    const s = await getSettings();
    const newSettings = { ...s, ...updates };
    await saveSettings(newSettings);
    setSettings(newSettings);
  }, []);

  return (
    <AppContext.Provider value={{
      lang, theme, settings,
      setLang, setTheme, updateSettings,
      isAuthenticated, setAuthenticated,
    }}>
      {children}
    </AppContext.Provider>
  );
}
