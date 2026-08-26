import { useMemo } from 'react';
import type { ThemeConfig } from 'antd';

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Đọc token màu/spacing từ design-system.css (nguồn duy nhất) thay vì khai báo trùng 1 bộ
 * hex cứng riêng cho AntD ConfigProvider — trước đây 2 nơi này đã lệch nhau (`colorBgBase`
 * vẫn giữ giá trị cũ #f9f9ff dù CSS đã đổi --surface sang #f4f6fb).
 */
export function useAntdTheme(mode: 'light' | 'dark' = 'light'): ThemeConfig {
  return useMemo(() => ({
    token: {
      colorPrimary: cssVar('--primary', '#005daa'),
      colorBgBase: cssVar('--surface', '#f4f6fb'),
      colorBgContainer: cssVar('--surface-container-lowest', '#ffffff'),
      colorBgElevated: cssVar('--surface-container-lowest', '#ffffff'),
      colorBorder: cssVar('--outline-variant', 'rgba(116, 119, 127, 0.15)'),
      colorText: cssVar('--on-surface', '#131b2c'),
      colorTextSecondary: cssVar('--on-surface-variant', '#44474f'),
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      borderRadius: 8,
      fontSize: 14,
      controlHeight: 40,
      colorError: cssVar('--error', '#ba1a1a'),
      colorSuccess: cssVar('--success', '#1a7a2e'),
      colorWarning: cssVar('--warning', '#934600'),
    },
    components: {
      Card: { boxShadowTertiary: 'none' },
      Table: { borderColor: 'transparent', headerBg: cssVar('--surface-container-low', '#f1f3ff') },
      Button: { primaryShadow: 'none' },
      Input: { activeBorderColor: 'transparent', hoverBorderColor: 'transparent' },
      Select: { optionSelectedBg: cssVar('--surface-container-high', '#e0e8ff') },
      Modal: { contentBg: cssVar('--surface-container-lowest', '#ffffff'), headerBg: cssVar('--surface-container-lowest', '#ffffff') },
      Menu: { darkItemBg: 'transparent', darkSubMenuItemBg: 'transparent' },
    },
  }), [mode]);
}
