# `src/` — application source

| Folder | Role |
|---|---|
| `lib/` | Core logic: Dexie schema (`db.ts`), paise math (`money.ts`), double-entry (`accounting.ts`), business transactions, sync engine, reports, validators, seed |

**Local DB versioning (two layers):**

| Layer | Where | When to change |
|---|---|---|
| **Schema** | `db.ts` — Dexie `version(n).stores()` | New table, index, or store shape |
| **Data** | `lib/migrations/registry.ts` — append to `DATA_MIGRATIONS` | Backfill, re-key, or repair existing rows |

`main.tsx` → `seedDatabase()` → `runMigrations()` on every launch. Fresh installs pre-mark migrations they do not need (e.g. deterministic ids). This is intentional: data migrations often touch sync queue and multi-table rewrites, which fit poorly in Dexie `.upgrade()` transactions.
| `hooks/` | React hooks: Dexie live queries, sync status, overlay back/swipe, settings, financials |
| `store/` | Zustand stores: app UI, sync, toast, theme, period filter |
| `components/` | Reusable UI — `layout/`, `common/`, `charts/`, `forms/` |
| `pages/` | Route-level screens (lazy-loaded from `App.tsx`) |
| `styles/` | Global CSS + Tailwind v4 theme tokens |

**Entry:** `main.tsx` → seeds DB, starts sync, mounts `App.tsx`.

**Rules:** Read from Dexie in components; post journal entries for all money events; use `MoneyDisplay` / `MoneyInput` for amounts; mobile-first Tailwind only.

See root [README.md](../README.md) and [.cursorrules](../.cursorrules) for full conventions.
