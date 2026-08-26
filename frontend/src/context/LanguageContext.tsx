import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Lang, TranslationKey, translations } from '../i18n/translations';

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'vi',
  setLang: () => {},
  t: (key) => key,
});

const STORAGE_KEY = 'qlbdx_lang';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    return saved === 'en' ? 'en' : 'vi';
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[lang][key] ?? translations['vi'][key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
