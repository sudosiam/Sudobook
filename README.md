# Sudo Books

**v4.0.0** — Local-first accounting & finance PWA for [Biswajit Power Hub](https://www.biswajitpowerhub.com) (EV showroom, Berhampore, West Bengal).

Complete **double-entry bookkeeping**, inventory, banking, AR/AP, and financial reports for a **solo owner**. Indian Rupee (INR) only, April–March financial year, mobile-first Android PWA. **Not** an invoicing app. **No GST.**

---

## What it does

| Module | Capabilities |
|--------|----------------|
| **Dashboard** | FY metrics, revenue trend, net worth, low-stock alerts; cached for speed |
| **Sales** | Line items, discounts, cash/bank/UPI, credit & partial payments, customer AR, void |
| **Purchases** | Vendor AP, discounts, weighted-average inventory cost, partial payments, void |
| **Expenses** | Chart-of-accounts categories (502–599), custom categories (508–599), recurring (days 1–31) |
| **Inventory** | Products, categories, SKU auto-numbering, stock movements, valuation report |
| **Customers / Vendors** | Opening balances, statements, aging reports, outstanding payment lists |
| **Banking** | Cash + bank accounts, transfers (with GL), manual entries, reconciliation, void/reverse |
| **Ledger** | General ledger, trial balance, chart of accounts |
| **Reports** | P&L, balance sheet, cash flow, sales/purchase/expense reports, inventory valuation |
| **Growth** | Top customers, sales mix, average sale, net-worth series |
| **More** | Fixed assets, loans, credit cards, owner capital contributions & draws |
| **Settings** | Business name, theme, cloud auth, sync panel, backup/restore, ledger repair, factory reset |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React UI  →  Dexie (IndexedDB)  ←  source of truth       │
│       ↑              ↓                                       │
│  useLiveQuery    Dexie Cloud (optional backup + sync)       │
└─────────────────────────────────────────────────────────────┘
```

- **Local-first:** All reads/writes go through Dexie. The app works fully offline without configuration.
- **Double-entry:** Every money event posts a balanced journal entry. Account balances are **computed** from journal lines, never stored on accounts.
- **Paise integers:** All money is integer paise (₹1 = 100). Use `src/lib/money.ts` only — no floating-point money math.
- **Immutable journals:** Posted entries are never deleted; mistakes are corrected by voiding (`status: 'void'`) or reversing entries.

See [`.cursorrules`](.cursorrules) for full coding conventions.

---

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 18, React Router 6, Tailwind CSS v4, Motion |
| Forms | React Hook Form + Zod (with input sanitization) |
| Local DB | Dexie 4 + dexie-react-hooks (schema **v5**) |
| Cloud sync | Dexie Cloud (optional) — automatic offline-first sync |
| State | Zustand (app, sync, toast, theme, period) |
| Charts | Recharts |
| Build | Vite 5 + vite-plugin-pwa |
| Deploy | Vercel (SPA rewrites + security headers) |

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

First launch seeds the chart of accounts, cash drawer, product categories, and settings. Data migrations run automatically (tracked in `settings.migrations`).

### Optional: cloud backup (Dexie Cloud)

1. Run `npx dexie-cloud create` and copy your database URL.
2. Copy [`.env.example`](.env.example) → `.env.local` and set `VITE_DEXIE_CLOUD_URL`.
3. Restart dev server. Sign in under **Settings → Cloud Account** (email OTP).

Details: [`dexie-cloud/README.md`](dexie-cloud/README.md)

---

## Sync engine

| Trigger | When |
|---------|------|
| **Interval** | Every **10 seconds** while online |
| **After writes** | ~2 s debounce (`requestSync`) |
| **Reconnect** | `online` event, window focus, tab visible |
| **Manual** | Settings → Sync Now |

**Push:** `syncQueue` batches (100/run) → Supabase upsert; deletes set `deleted_at`. Duplicate queue rows coalesce (delete wins). Failed permanent rows purge after 90 days.

**Pull:** Incremental by `updated_at` watermarks (`lastPullAt` + per-table `lastPullAtByTable`). 500 rows/page. Skips rows with pending local edits. Never re-applies remote data over a local voided journal.

**Document numbers:** Per-device suffix (e.g. `SALE-2026-001-A3F9K2`) avoids cross-device collisions. Settings/sequences are local-only.

---

## Database (Dexie v5)

| Store | Synced to cloud? | Purpose |
|-------|------------------|---------|
| `accounts`, `journalEntries` | Yes | Chart of accounts + double-entry ledger |
| `customers`, `vendors` | Yes | Parties with opening balances |
| `products`, `productCategories`, `stockMovements` | Yes | Inventory |
| `sales`, `purchases`, `expenses`, `recurringExpenses` | Yes | Business documents |
| `bankAccounts`, `bankTransactions` | Yes | Cash/bank register |
| `syncQueue` | No | Outbound sync backlog |
| `settings` | No | Singleton app config, sequences, watermarks |
| `dashboardCache` | No | Computed dashboard metrics |
| `backupSnapshots` | No | Rolling on-device backup copies (max 5) |

**Schema bumps:** edit `src/lib/db.ts` `version(n).stores()`.  
**Data migrations:** append to `src/lib/migrations/registry.ts` (run inside Dexie transactions).

---

## Chart of accounts

| Range | Accounts |
|-------|----------|
| **100–199 Assets** | 101 Cash, 102 Bank, 103 Receivable, 104 Inventory, 105 Fixed Assets |
| **200–299 Liabilities** | 201 Payable, 202 Loans, 203 Credit Cards |
| **300–399 Equity** | 301 Owner's Capital, 302 Retained Earnings |
| **400–499 Income** | 401 Product Sales, 402 Other Income |
| **500–599 Expenses** | 501 COGS, 502–507 default expenses, 508–599 user categories |

Bank sub-accounts (HDFC, SBI, etc.) all post to COA **102**; per-bank balances come from `bankTransactions`, not separate GL accounts.

---

## Backup & data safety

| Feature | Location |
|---------|----------|
| **Export JSON** | Settings → Download JSON / Backup now |
| **Checksum** | Backup v2 includes SHA-256 — restore rejects tampered files |
| **Automatic backup** | Daily / weekly / monthly; optional download + local snapshots |
| **Storage meter** | Settings shows IndexedDB quota usage |
| **Factory reset** | Downloads backup first, then wipes local + cloud (when signed in) |

Keep downloaded `.json` files in Google Drive or email — they survive app uninstall.

---

## Security

- **Input sanitization** — HTML/control chars stripped on all text fields (Zod transforms)
- **CSP + HSTS** — strict headers via `vercel.json` (`frame-ancestors 'none'`, Supabase-only `connect-src`)
- **Auth cooldown** — 5 failed sign-ins → 60 s lockout (client-side)
- **Bank numbers masked** — last 4 digits in UI (`•••• 1234`)
- **Amount cap** — ₹10 crore max per field
- **RLS** — Supabase rows scoped to `auth.uid() = user_id` (anon key is public by design)

IndexedDB data is **plaintext on device** — physical access to an unlocked phone exposes records. Use device lock + backups.

---

## Performance

- **Virtual scrolling** — Sales & product lists (`@tanstack/react-virtual`, 50 rows/page)
- **Dashboard cache** — metrics stored in Dexie; invalidated on every journal post/void
- **Stale-while-revalidate** — `useStaleLiveQuery` keeps last data visible during refresh
- **Streaming reports** — `foldPostedJournalLines()` iterates journal index instead of loading all rows
- **Code splitting** — lazy routes with retry; vendor chunks for react, dexie, supabase, charts

---

## PWA

- Installable (Android primary target); `registerType: 'prompt'` with update banner
- Works offline after first load; service worker precaches static assets
- `navigator.storage.persist()` requested on boot to reduce eviction risk
- Theme: dark/light toggle; brand `#0b0d10` shell

---

## Project layout

```
src/
  lib/           db, money, accounting, transactions, sync, reports, backup, validators
  hooks/         live queries, sync, settings, financials, overlay navigation
  store/         Zustand stores
  components/    layout, common UI, charts, forms
  pages/         route screens (lazy-loaded from App.tsx)
supabase/        cloud schema + RLS migrations
scripts/         dev helpers (icons, cloud inspect) — see scripts/README.md
.github/         weekly Supabase pg_dump workflow (optional secret)
```

Entry: `main.tsx` → seed → migrations → sync engine → backup scheduler → React app.

---

## Routes

| Path | Screen |
|------|--------|
| `/` | Dashboard |
| `/sales`, `/sales/new`, `/sales/:id` | Sales |
| `/purchases`, `/purchases/new`, `/purchases/:id` | Purchases |
| `/expenses`, `/expenses/new`, `/expenses/categories`, `/expenses/recurring/new` | Expenses |
| `/inventory`, `/inventory/categories`, `/inventory/:id` | Inventory |
| `/customers`, `/customers/:id`, `/customers/:id/statement` | Customers |
| `/vendors`, `/vendors/:id`, `/vendors/:id/statement` | Vendors |
| `/banking`, `/banking/:id`, `/banking/transfer`, `/banking/manual-entry`, `/banking/:bankId/transactions/:txnId` | Banking |
| `/payments`, `/payments/payable` | Outstanding receivables / payables |
| `/ledger`, `/ledger/trial-balance`, `/ledger/accounts` | Ledger |
| `/reports` + `/reports/pnl`, `balance-sheet`, `cashflow`, etc. | Reports |
| `/growth` | Growth analytics |
| `/more` + fixed-asset, loan, credit-card, owner-capital | Adjustments |
| `/settings` | Settings, sync, backup |

Bottom nav: Dashboard · Sales · Banking · Reports · Settings (More via sidebar).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production PWA → `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run gen:icons` | Regenerate PWA icons |

---

## Verification (pre-release)

```bash
npm run typecheck   # must pass
npm run build       # must pass
```

**Smoke test** (390px viewport or installed PWA):

- [ ] Offline: create a sale → reload → data persists
- [ ] Void a sale → stock restored, journal voided, reports update
- [ ] Settings → Export backup → restore on fresh tab (checksum OK)
- [ ] Sign in → Sync Now → pending count clears
- [ ] Banking transfer posts GL entry + both bank txns

---

## Deployment (Vercel)

1. Import repo → set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (optional).
2. Deploy. [`vercel.json`](vercel.json) handles SPA rewrites, security headers, and `no-cache` for `sw.js`.
3. Push to `main` triggers production when linked.

Ping Supabase REST every ~72 h (e.g. [cron-job.org](https://cron-job.org)) to keep free-tier projects awake.

---

## Version history

| Version | Highlights |
|---------|------------|
| **3.0.0** | Major release: security hardening, scheduled backup + checksums, performance (virtual lists, dashboard cache), purchase discounts, bug-fix sweep, 10 s sync, full docs |
| 2.1.15 | Scheduled JSON backup, rolling snapshots, Dexie v5 |
| 2.1.12 | Bank transfer GL, recurring dedup, sync delete coalesce, balance fixes |
| 2.1.11 | Virtual lists, dashboard cache, incremental sync watermarks |
| 2.1.0 | Branded PWA icons, bank txn detail, migration hardening |

---

## License

Private — Biswajit Power Hub. All rights reserved.
