import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'qlbdx_theme_mode';

/** Cung cấp theme sáng/tối toàn app — lưu lựa chọn vào localStorage, áp qua data-theme trên <html>. */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Áp thuộc tính DOM đồng bộ (useLayoutEffect, không phải useEffect) — nếu không, ConfigProvider
  // đọc lại CSS var qua getComputedStyle sẽ bị lệch 1 nhịp render so với theme vừa đổi.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light';
      // Set ngay tại đây (không đợi effect) để component tiêu thụ context re-render cùng lượt
      // đọc đúng CSS var mới — useLayoutEffect ở trên chỉ còn tác dụng cho lần mount đầu.
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  return <ThemeContext.Provider value={{ mode, toggleMode }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme phải dùng bên trong ThemeProvider');
  return ctx;
};
