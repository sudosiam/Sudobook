# Sudo Books

**v5.0.0** — Local-only accounting & finance PWA for [Biswajit Power Hub](https://www.biswajitpowerhub.com) (EV showroom, Berhampore, West Bengal).

Complete **double-entry bookkeeping**, inventory, banking, AR/AP, and financial reports for a **solo owner**. Indian Rupee (INR) only, April–March financial year, mobile-first Android PWA. **Not** an invoicing app. **No GST.**

---

## What it does

| Module | Capabilities |
|--------|----------------|
| **Dashboard** | FY/period metrics, revenue trend, net worth series, low-stock alerts; Dexie-cached for speed |
| **Sales** | Line items, discounts, cash/bank/UPI, credit & partial payments, customer AR, void |
| **Purchases** | Vendor AP, discounts, weighted-average inventory cost, partial payments, void |
| **Expenses** | Chart-of-accounts categories (502–599), user-defined categories, recurring by day-of-month |
| **Inventory** | Products, categories, SKU auto-numbering, stock movements, valuation report |
| **Customers / Vendors** | Opening balances, statements, aging reports, outstanding payment lists |
| **Banking** | Cash + bank accounts, transfers (with GL entry), manual entries, transaction void/reverse |
| **Ledger** | General ledger, trial balance, chart of accounts |
| **Reports** | P&L, balance sheet, cash flow, sales/purchase/expense reports, inventory valuation, aging |
| **Growth** | Top customers, sales mix, average sale value, net-worth series |
| **More** | Fixed assets, loans, credit cards, owner capital contributions & draws |
| **Settings** | Business name, theme toggle, JSON backup/restore, factory reset |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React UI  →  Dexie (IndexedDB)  ←  source of truth        │
│       ↑              ↓                                       │
│  useLiveQuery    local-only — no cloud sync                  │
└─────────────────────────────────────────────────────────────┘
```

- **Local-first:** All reads/writes go through Dexie. The app works fully offline without any configuration.
- **Double-entry:** Every money event posts a balanced journal entry via `postJournalEntry()`. Account balances are **computed** from journal lines — never stored on account rows.
- **Paise integers:** All money is integer paise (₹1 = 100). Use `src/lib/money.ts` only — no floating-point money math anywhere.
- **Immutable journals:** Posted entries are never edited or deleted; mistakes are corrected by voiding (`status: 'void'`) the original entry. Voided entries stay in the ledger forever.

See [`.cursorrules`](.cursorrules) for full coding conventions.

---

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 18, React Router 6, Tailwind CSS v4, Motion (Framer) |
| Forms | React Hook Form + Zod (with HTML/control-char sanitization) |
| Local DB | Dexie 4 + dexie-react-hooks (schema **v7**) |
| State | Zustand (app, toast, theme, period filter) |
| Charts | Recharts |
| Build | Vite 5 + vite-plugin-pwa (Workbox, `generateSW`) |
| Deploy | Vercel (SPA rewrites + strict security headers) |

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

First launch seeds the chart of accounts, cash drawer, default product categories, and the singleton settings row. Data migrations run automatically on every boot (tracked in `settings.migrations`).

---

## Database (Dexie schema v7)

| Store | Purpose |
|-------|---------|
| `accounts` | Chart of accounts (deterministic UUIDs, never deleted) |
| `journalEntries` | Immutable double-entry ledger (status: posted \| void) |
| `customers`, `vendors` | Parties with opening balances |
| `products`, `productCategories`, `stockMovements` | Inventory with weighted-average cost |
| `sales`, `purchases`, `expenses`, `recurringExpenses` | Business documents |
| `bankAccounts`, `bankTransactions` | Cash/bank register |
| `settings` | Singleton: sequences, FY, device ID, migration tokens |
| `dashboardCache` | Computed dashboard metrics (invalidated on journal change) |
| `backupSnapshots` | Rolling on-device backup copies (max 5) |
| `backupFolder` | File System Access API directory handle for scheduled backups |

**Schema bumps:** edit `src/lib/db.ts` `version(n).stores()` and increment the version number.  
**Data migrations:** append to `src/lib/migrations/registry.ts` (run atomically inside Dexie transactions on every app boot).

---

## Chart of accounts

| Range | Accounts |
|-------|----------|
| **100–199 Assets** | 101 Cash, 102 Bank, 103 Receivable, 104 Inventory, 105 Fixed Assets |
| **200–299 Liabilities** | 201 Payable, 202 Loans, 203 Credit Cards |
| **300–399 Equity** | 301 Owner's Capital, 302 Retained Earnings |
| **400–499 Income** | 401 Product Sales, 402 Other Income |
| **500–599 Expenses** | 501 COGS, 502–507 built-in, 508–599 user-defined categories |

Bank sub-accounts (HDFC, SBI, etc.) all post to COA **102**; per-bank balances are computed from `bankTransactions`, not separate GL accounts.

All account UUIDs are **deterministic** (`src/lib/coa.ts:accountUuid`), so a fresh install always produces identical primary keys for the built-in chart of accounts.

**Document numbers:** A per-device suffix (e.g. `SALE-2026-001-A3F9K2`) is appended to avoid collisions if you restore backups across devices.

---

## Backup & data safety

| Feature | Location |
|---------|----------|
| **Export JSON** | Settings → Download JSON / Backup now |
| **Checksum** | Backup v2 includes SHA-256 — restore rejects tampered files |
| **Automatic backup** | Daily / weekly / monthly; optional download + rolling local snapshots (max 5) |
| **Folder backup** | Settings → select a folder; future auto-backups save there (File System Access API) |
| **Storage meter** | Settings shows IndexedDB quota usage |
| **Factory reset** | Downloads a JSON backup first, then wipes all local data |

Keep downloaded `.json` files in Google Drive or email — they survive app reinstall or device loss.

---

## Security

- **Input sanitization** — HTML/control chars stripped on all text fields (Zod `.transform()` via `src/lib/sanitize.ts`)
- **CSP + HSTS** — strict headers via `vercel.json` (`frame-ancestors 'none'`; `connect-src 'self'` only)
- **Bank numbers masked** — last 4 digits shown in UI (`•••• 1234`)
- **Amount cap** — ₹10 crore (1 000 000 000 paise) maximum per field, enforced in Zod schemas
- **Paise-only math** — `Math.round()` wraps every fractional operation; no raw floating-point accumulation

IndexedDB data is **plaintext on device** — physical access to an unlocked phone exposes records. Use device lock + export backups regularly.

---

## Performance

- **Virtual scrolling** — Sales & product lists use `@tanstack/react-virtual` (50 rows/page)
- **Dashboard cache** — metrics stored in `dashboardCache` table; revision counter invalidates on every journal post/void
- **Stale-while-revalidate** — `useStaleLiveQuery` keeps last rendered data visible while fresh data loads
- **Streaming reports** — `foldPostedJournalLines()` walks the `date` index without loading the full journal into memory
- **Code splitting** — lazy routes with auto-retry; dedicated Rollup chunks for react, dexie, charts, forms, router

---

## PWA

- Installable (Android primary target); `registerType: 'prompt'` with in-app update banner
- Works fully offline after first load; Workbox precaches all static assets
- `navigator.storage.persist()` requested on boot to reduce browser eviction risk
- Theme: dark/light toggle (stored in localStorage); brand `#0b0d10` shell

---

## Project layout

```
src/
  lib/           db, money, accounting, transactions, reports, backup, validators, seed
  lib/migrations/   data-only migrations tracked in settings.migrations
  hooks/         useLiveQuery wrappers, settings, financials, overlay navigation
  store/         Zustand stores (app, toast, theme, period filter)
  components/    layout, common UI, charts, forms
  pages/         route screens (lazy-loaded from App.tsx)
public/
  icons/         PWA icons (192 × 192, 512 × 512, maskable)
scripts/         dev helpers (icon generation) — see scripts/README.md
```

Entry point: `main.tsx` → seed DB → run migrations → start backup scheduler → mount React app.

---

## Routes

| Path | Screen |
|------|--------|
| `/` | Dashboard |
| `/sales`, `/sales/new`, `/sales/:id` | Sales list, new sale, sale detail |
| `/purchases`, `/purchases/new`, `/purchases/:id` | Purchases |
| `/expenses`, `/expenses/new`, `/expenses/categories`, `/expenses/recurring/new` | Expenses |
| `/inventory`, `/inventory/categories`, `/inventory/:id` | Inventory |
| `/customers`, `/customers/:id`, `/customers/:id/statement` | Customers |
| `/vendors`, `/vendors/:id`, `/vendors/:id/statement` | Vendors |
| `/banking`, `/banking/:id`, `/banking/transfer`, `/banking/manual-entry` | Banking overview, account detail, transfer, manual entry |
| `/banking/:bankId/transactions/:txnId` | Bank transaction detail |
| `/payments`, `/payments/payable` | Outstanding receivables / payables |
| `/ledger`, `/ledger/trial-balance`, `/ledger/accounts` | General ledger, trial balance, chart of accounts |
| `/reports` + sub-routes | P&L, balance sheet, cash flow, sales/purchase/expense/inventory reports, aging |
| `/growth` | Growth analytics |
| `/more` + fixed-asset, loan, credit-card, owner-capital | Capital & liability adjustments |
| `/settings` | Settings, backup |

Bottom nav: **Dashboard · Sales · Banking · Reports · Settings** (More and other sections accessible via the sidebar/settings).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR at `http://localhost:5173` |
| `npm run build` | TypeScript type-check + production PWA build → `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run typecheck` | `tsc -b --noEmit` (no output files, errors only) |
| `npm run gen:icons` | Regenerate PWA icons from source |

---

## Verification (pre-release)

```bash
npm run typecheck   # must exit 0
npm run build       # must exit 0
```

**Smoke test** (390 px viewport or installed PWA on Android):

- [ ] Offline: create a sale → reload → data persists in IndexedDB
- [ ] Void a sale → stock qty restored, journal entry voided, dashboard updates
- [ ] Settings → Export backup → restore on fresh tab (checksum verified)
- [ ] Banking transfer posts balanced GL entry + two bank txn rows
- [ ] Recurring expense fires on next boot if a new month has started

---

## Deployment (Vercel)

1. Import repo on Vercel.
2. Deploy. [`vercel.json`](vercel.json) handles SPA rewrites, strict security headers, and `no-cache` for `sw.js`.
3. Push to `main` triggers a production deploy when linked.

---

## Version history

| Version | Highlights |
|---------|------------|
| **5.0.0** | Removed Dexie Cloud and all legacy Supabase sync — pure local-only Dexie app |
| **4.0.0** | Dexie Cloud sync; schema v7 with `backupFolder`; stale-while-revalidate dashboard |
| **3.0.0** | Security hardening, scheduled backup + SHA-256 checksums, virtual lists, dashboard Dexie cache, purchase discounts, 10 s sync interval, full docs |
| 2.1.15 | Scheduled JSON backup, rolling snapshots, Dexie schema v5 |
| 2.1.12 | Bank transfer GL, recurring expense dedup, balance fixes |
| 2.1.11 | Virtual lists, dashboard cache, incremental sync watermarks |
| 2.1.0 | Branded PWA icons, bank txn detail, migration hardening |

---

## License

Private — Biswajit Power Hub. All rights reserved.
