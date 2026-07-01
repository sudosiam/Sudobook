# Sudo Books

**v2.1.0** — Local-first accounting & finance PWA for [Biswajit Power Hub](https://www.biswajitpowerhub.com) (EV showroom, Berhampore, West Bengal).

Not an invoicing app. No GST. A complete **double-entry accounting**, inventory, banking, and reporting system for a single owner — Indian Rupee (INR), April–March financial year, mobile-first Android PWA.

## Features

| Area | Capabilities |
|---|---|
| **Sales** | Record sales, partial/credit payments, customer AR, statements, aging |
| **Purchases** | Vendor AP, payables, purchase reports |
| **Expenses** | Categories (default + custom 508–599), recurring expenses |
| **Inventory** | Products, categories, stock, valuation report |
| **Banking** | Multi-bank accounts, transfers, manual entries |
| **Accounting** | General ledger, trial balance, chart of accounts |
| **Reports** | P&L, balance sheet, cash flow, sales/purchase/expense reports, growth analytics |
| **More** | Fixed assets, loans, credit cards, owner capital |
| **Sync** | Optional Supabase cloud backup; works fully offline |

## Stack

React 18 · Vite 5 · TypeScript (strict) · Tailwind v4 · Dexie 4 (IndexedDB) · Supabase v2 (optional sync) · Zustand · React Router 6 · React Hook Form + Zod · Recharts · Motion · vite-plugin-pwa

## Iron rules (never break these)

1. **Paise integers** — every money value is stored as integer paise (₹1 = 100). Use `src/lib/money.ts` only.
2. **Double-entry** — every money movement posts a balanced journal entry via `postJournalEntry()`. Balances are computed from entries, never stored.
3. **Local-first** — UI reads Dexie; writes go to Dexie + sync queue. Supabase is backup, not primary.
4. **UUID keys**, **ISO date strings**, **no `any`**, **Tailwind only**, **mobile-first** (390px baseline).

See `.cursorrules` for the full project conventions.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

The app works **fully offline** with no configuration. First run seeds the chart of accounts, cash drawer, and settings into IndexedDB.

### Optional: cloud sync (Supabase)

1. Create a Supabase project.
2. Run migrations in `supabase/migrations/` **in numeric order** (001 → 007).  
   Existing projects that skipped 006/007 can run `supabase/migrations/RUN_ME_PENDING.sql` once instead.
3. Copy `.env.example` → `.env.local`:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Restart `npm run dev`. Sync pushes queued changes every 30s and on reconnect.

Cloud rows mirror Dexie records as JSONB (`id`, `user_id`, `data`, `updated_at`, `deleted_at`) with per-user Row Level Security.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production PWA build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only (`tsc -b --noEmit`) |
| `npm run gen:icons` | Regenerate PWA icons in `public/icons/` |

Dev/ops helpers live in `scripts/` — see [scripts/README.md](scripts/README.md).

## Project structure

```
src/
  lib/           money, db (Dexie), accounting, transactions, reports, sync, validators
  hooks/         live queries, sync, settings, overlay back/swipe, financials
  store/         Zustand (app, sync, toast, theme, period)
  components/    layout (AppShell, Sidebar, BottomNav), common UI, charts, forms
  pages/         dashboard, sales, purchases, expenses, inventory, customers,
                 vendors, banking, ledger, reports, growth, more, settings, payments
supabase/        cloud schema migrations + RLS — see supabase/README.md
scripts/         icons, migrations, cloud inspection — see scripts/README.md
.github/         weekly Supabase DB backup workflow
```

## Routes (SPA)

| Path | Page |
|---|---|
| `/` | Dashboard |
| `/sales`, `/sales/new`, `/sales/:id` | Sales |
| `/purchases`, `/purchases/new`, `/purchases/:id` | Purchases |
| `/expenses`, `/expenses/new`, `/expenses/categories`, `/expenses/recurring/new` | Expenses |
| `/inventory`, `/inventory/categories`, `/inventory/:id` | Inventory |
| `/customers`, `/customers/:id`, `/customers/:id/statement` | Customers |
| `/vendors`, `/vendors/:id`, `/vendors/:id/statement` | Vendors |
| `/banking`, `/banking/:id`, `/banking/transfer`, `/banking/manual-entry` | Banking |
| `/payments`, `/payments/payable` | Outstanding receivables / payables |
| `/ledger`, `/ledger/trial-balance`, `/ledger/accounts` | Ledger |
| `/reports` + `/reports/pnl`, `balance-sheet`, `cashflow`, etc. | Reports |
| `/growth` | Growth analytics |
| `/more` + fixed-asset, loan, credit-card, owner-capital | More |
| `/settings` | Settings & sync |

## Verification (pre-release)

```bash
npm run typecheck   # must pass
npm run build       # must pass — also validates PWA manifest + service worker
```

Manual smoke test on a 390px viewport (or Android PWA):

- [ ] Offline mode: DevTools → Network → Offline — create a sale, verify it persists after reload
- [ ] Sidebar opens and navigates (e.g. Expenses) without closing prematurely
- [ ] Full-screen forms: back arrow, swipe-back, Android hardware back
- [ ] Money displays as ₹ with right-aligned tabular figures in lists
- [ ] Sync panel (Settings) shows pending count and last sync when online

## Deployment (Vercel)

1. Import the GitHub repo into [Vercel](https://vercel.com).
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (optional — app works without them).
3. Deploy. `vercel.json` handles SPA rewrites and `no-cache` for `sw.js`.

Push to `main` triggers production deploy when the repo is linked.

To keep a free Supabase project awake, ping its REST endpoint every ~72h (e.g. [cron-job.org](https://cron-job.org)).

## Version history

| Version | Highlights |
|---|---|
| **2.1.0** | Release polish, docs, sidebar/nav fix, cleanup |
| 2.0.5 | Sidebar navigation fix (no `history.back` on route change) |
| 2.0.4 | Custom expense categories; sidebar fix attempt |
| 2.0.3 | More: loans, credit cards, owner capital |
| 2.0.2 | Full-screen mobile forms, swipe/back everywhere |
| 2.0.1 | Sync loop fix; dashboard sync badge removed |

## License

Private — Biswajit Power Hub. All rights reserved.
