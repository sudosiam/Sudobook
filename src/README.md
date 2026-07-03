# `src/` — application source

| Folder | Role |
|---|---|
| `lib/` | Core logic: Dexie schema (`db.ts`), paise math (`money.ts`), double-entry (`accounting.ts`), business transactions, reports, backup, validators, seed |
| `lib/migrations/` | One-time data migrations tracked in `settings.migrations` |
| `hooks/` | React hooks: Dexie live queries, overlay back/swipe, settings, financials |
| `store/` | Zustand stores: app UI, toast, theme, period filter |
| `components/` | Reusable UI — `layout/`, `common/`, `charts/`, `forms/` |
| `pages/` | Route-level screens (lazy-loaded from `App.tsx`) |
| `styles/` | Global CSS + Tailwind v4 theme tokens |

**Local DB versioning (two layers):**

| Layer | Where | When to change |
|---|---|---|
| **Schema** | `db.ts` — Dexie `version(n).stores()` | New table, index, or store shape |
| **Data** | `lib/migrations/registry.ts` — append to `DATA_MIGRATIONS` | Backfill, re-key, or repair existing rows |

**Entry:** `main.tsx` → `seedDatabase()` → `runMigrations()` → `startBackupScheduler()` → mount `App.tsx`.

**Rules:** Read from Dexie in components; post journal entries for all money events; use `MoneyDisplay` / `MoneyInput` for amounts; mobile-first Tailwind only.

See root [README.md](../README.md) and [.cursorrules](../.cursorrules) for full conventions.
