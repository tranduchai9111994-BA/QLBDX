/**
 * chartTheme.ts — đọc màu chart từ CSS variable thay vì hardcode hex rời rạc
 * (UIUX_AUDIT §7.1, C-01). Gọi trong useMemo ở component dùng chart.
 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function getChartColors(): string[] {
  return [
    cssVar('--primary', '#005daa'),
    cssVar('--success', '#1a7a2e'),
    cssVar('--warning', '#934600'),
    cssVar('--error', '#ba1a1a'),
    cssVar('--chart-accent-1', '#6750a4'),
    cssVar('--primary-container', '#0075d5'),
    cssVar('--chart-accent-2', '#2e7d32'),
  ];
}

export const chartColor = {
  primary: () => cssVar('--primary', '#005daa'),
  primaryContainer: () => cssVar('--primary-container', '#0075d5'),
  success: () => cssVar('--success', '#1a7a2e'),
  warning: () => cssVar('--warning', '#934600'),
  error: () => cssVar('--error', '#ba1a1a'),
  accent1: () => cssVar('--chart-accent-1', '#6750a4'),
  accent2: () => cssVar('--chart-accent-2', '#2e7d32'),
  neutral: () => cssVar('--outline-variant', 'rgba(116,119,127,0.15)'),
  onSurfaceVariant: () => cssVar('--on-surface-variant', '#44474f'),
  onSurface: () => cssVar('--on-surface', '#131b2c'),
};
