export interface ChartColors {
  surface: string;
  border: string;
  text: string;
  muted: string;
  app: string;
  surfaceHover: string;
  brand: string;
  brandLight: string;
  success: string;
  danger: string;
  warning: string;
}

/** Chart colors derived from CSS theme tokens (updates when theme changes). */
export function chartThemeColors(): ChartColors {
  if (typeof document === 'undefined') {
    return {
      surface: '#16181d',
      border: '#262a31',
      text: '#f3f4f6',
      muted: '#9aa1ac',
      app: '#0b0d10',
      surfaceHover: '#1f232a',
      brand: '#2563eb',
      brandLight: '#60a5fa',
      success: '#34d399',
      danger: '#f87171',
      warning: '#fbbf24',
    };
  }
  const root = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback;
  return {
    surface: pick('--c-surface', '#16181d'),
    border: pick('--c-border', '#262a31'),
    text: pick('--c-text', '#f3f4f6'),
    muted: pick('--c-muted', '#9aa1ac'),
    app: pick('--c-app-bg', '#0b0d10'),
    surfaceHover: pick('--c-surface-hover', '#1f232a'),
    brand: pick('--c-brand', '#2563eb'),
    brandLight: pick('--c-brand-light', '#60a5fa'),
    success: pick('--c-success', '#34d399'),
    danger: pick('--c-danger', '#f87171'),
    warning: pick('--c-warning', '#fbbf24'),
  };
}

/** Ordered palette for categorical charts (pie/bar segments). */
export function chartPalette(colors = chartThemeColors()): string[] {
  return [colors.brand, colors.brandLight, colors.success, colors.warning, colors.danger, colors.muted];
}

export function chartTooltipProps(colors = chartThemeColors()) {
  return {
    contentStyle: {
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      color: colors.text,
    },
    labelStyle: { color: colors.text },
    itemStyle: { color: colors.text },
  };
}
