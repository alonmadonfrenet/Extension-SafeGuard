import { useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { translations } from '../i18n/translations.js';

export function useTranslation() {
  const { lang } = useContext(AppContext);
  
  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };
  
  return { t, lang };
}
