# Sudo Books

A local-first, mobile-first accounting & finance **PWA** for **Biswajit Power Hub**
(an EV showroom in Berhampore, West Bengal). Not an invoicing app, no GST — a
complete double-entry accounting, inventory, banking and reporting system for a
single owner, in Indian Rupee, with an April–March financial year.

## Stack

React 18 · Vite 5 · TypeScript (strict) · Tailwind v4 · Dexie 4 (IndexedDB) ·
Supabase v2 (optional cloud sync) · Zustand · React Router 6 · React Hook Form +
Zod · Recharts · vite-plugin-pwa.

## The iron rules

1. **Paise integers** — every money value is an integer number of paise (₹1 = 100).
2. **`money.ts` is the only math** — `toPaise`, `toINR`, `addMoney`, `pct`, …
3. **Double-entry** — every money movement posts a balanced, immutable journal
   entry via `postJournalEntry()`. Balances are computed from entries, never stored.
4. **Local-first** — components read from Dexie; writes go to Dexie + a sync queue.
5. **UUID keys**, **ISO string dates**, **no `any`**, **Tailwind only**, **mobile-first**.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

The app works **fully offline** with no configuration. On first run it seeds the
chart of accounts, a cash drawer and settings into IndexedDB.

### Optional: cloud sync (Supabase)

1. Create a Supabase project and run the SQL in `supabase/migrations/` in order.
2. Copy `.env.example` to `.env.local` and set:

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

3. Restart `npm run dev`. The sync engine pushes queued changes every 30s and on reconnect.

Cloud rows mirror each Dexie record as JSONB (`id`, `user_id`, `data`, `updated_at`,
`deleted_at`) with per-user Row Level Security.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check + production build (PWA) |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript only, no emit |
| `npm run gen:icons` | Regenerate PWA icons |

## Project structure

```
src/
  lib/         money, db (Dexie), accounting engine, transactions, reports, sync…
  hooks/       Dexie live-query wrappers, sync, settings, financials
  store/       Zustand stores (app, sync, toast)
  components/  layout, common UI, charts, forms
  pages/       dashboard, sales, purchases, expenses, inventory, customers,
               vendors, banking, ledger, reports, growth, settings
supabase/migrations/   cloud schema, RLS, indexes
.github/workflows/     weekly DB backup
```

## Deployment (Vercel)

Import the repo into Vercel, set the two `VITE_SUPABASE_*` env vars (optional),
and deploy. `vercel.json` handles SPA rewrites and no-cache for the service worker.

To keep the free Supabase project from pausing, hit its REST endpoint every ~72h
with a free cron (e.g. cron-job.org).
