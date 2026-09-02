/**
 * Quản lý NGÔN NGỮ hiển thị (Việt / Anh) dùng chung toàn ứng dụng.
 *
 * Cách dùng trong component:  const { t } = useLanguage();  ...  {t('dashboard.title')}
 * Bảng nội dung dịch nằm ở frontend/src/i18n/translations.ts.
 */
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

// Lưu lựa chọn ngôn ngữ vào localStorage để lần mở sau vẫn giữ nguyên.
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

  /**
   * Hàm dịch. Có hai lớp dự phòng để giao diện không bao giờ hiện ô trống:
   *   1. Thiếu bản dịch tiếng Anh -> dùng tiếng Việt.
   *   2. Thiếu cả hai -> hiện chính khoá đó, để lập trình viên nhìn thấy ngay là còn sót.
   */
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
