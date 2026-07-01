# `src/` — application source

| Folder | Role |
|---|---|
| `lib/` | Core logic: Dexie schema (`db.ts`), paise math (`money.ts`), double-entry (`accounting.ts`), business transactions, sync engine, reports, validators, seed |
| `hooks/` | React hooks: Dexie live queries, sync status, overlay back/swipe, settings, financials |
| `store/` | Zustand stores: app UI, sync, toast, theme, period filter |
| `components/` | Reusable UI — `layout/`, `common/`, `charts/`, `forms/` |
| `pages/` | Route-level screens (lazy-loaded from `App.tsx`) |
| `styles/` | Global CSS + Tailwind v4 theme tokens |

**Entry:** `main.tsx` → seeds DB, starts sync, mounts `App.tsx`.

**Rules:** Read from Dexie in components; post journal entries for all money events; use `MoneyDisplay` / `MoneyInput` for amounts; mobile-first Tailwind only.

See root [README.md](../README.md) and [.cursorrules](../.cursorrules) for full conventions.
