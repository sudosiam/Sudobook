/** Shared compact Material-style surface classes — use across pages for consistency. */
export const ui = {
  /** Standard elevated card */
  card: 'rounded-2xl border border-border-app/40 bg-surface p-3 shadow-sm',
  /** Highlight / accent card */
  cardAccent: 'rounded-2xl border border-brand/25 bg-brand/8 p-3 shadow-sm',
  /** List container shell */
  listShell: 'overflow-hidden rounded-2xl border border-border-app/40 bg-surface shadow-sm',
  /** Single list row — still ≥52px touch-friendly */
  listRow:
    'flex min-h-[52px] items-center justify-between gap-2 border-b border-border-app/30 px-3 py-2 last:border-0 active:bg-surface-hover',
  /** Grid list row variant */
  listRowGrid:
    'grid min-h-[52px] items-center gap-2 border-b border-border-app/30 px-3 py-2 last:border-0 active:bg-surface-hover',
  /** Section label */
  sectionLabel: 'text-[11px] font-semibold uppercase tracking-wide text-muted',
  /** Page vertical rhythm */
  stack: 'space-y-3',
  /** Hero money amount */
  heroMoney: 'text-xl font-semibold tracking-tight',
  /** Secondary stat money */
  statMoney: 'text-lg font-semibold tracking-tight',
  /** Page section heading */
  heading: 'text-sm font-semibold text-foreground',
} as const;
