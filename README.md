# Sudo Books

**A local app.** Your books live entirely on this device — no cloud, no account, no internet required.

**v5.0.1** — Accounting & finance PWA for [Biswajit Power Hub](https://www.biswajitpowerhub.com) (EV showroom, Berhampore, West Bengal).

Complete **double-entry bookkeeping**, inventory, banking, AR/AP, and financial reports for a **solo owner**. Indian Rupee (INR) only, April–March financial year, mobile-first Android PWA. **Not** an invoicing app. **No GST.**

---

## What it does

| Module | Capabilities |
|--------|----------------|
| **Dashboard** | FY/period metrics, revenue trend, net worth series, low-stock alerts |
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
| **Settings** | Business name, theme, automatic JSON backup, manual export/restore, factory reset |

---

## How it works

```
React UI  →  Dexie (IndexedDB on your device)  →  source of truth
```

- **100% local** — All data stays in your browser's IndexedDB. Works fully offline after first load.
- **Double-entry** — Every money event posts a balanced journal entry. Balances are computed from journal lines, never stored on account rows.
- **Paise integers** — All money is integer paise (₹1 = 100). No floating-point money math.
- **Immutable journals** — Posted entries are never deleted; mistakes are corrected by voiding.
- **Your backup is your safety net** — Export JSON files to Google Drive, email, or a folder on your device.

No environment variables. No backend. No sign-in.

---

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 18, React Router 6, Tailwind CSS v4, Motion |
| Forms | React Hook Form + Zod |
| Local DB | Dexie 4 + dexie-react-hooks (schema v7) |
| State | Zustand |
| Charts | Recharts |
| Build | Vite 5 + vite-plugin-pwa |
| Deploy | Vercel (static PWA hosting) |

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

First launch seeds the chart of accounts, cash drawer, default product categories, and settings. Data migrations run automatically on every boot.

Install as a PWA on Android for the best experience (Add to Home Screen).

---

## Database (Dexie schema v7)

| Store | Purpose |
|-------|---------|
| `accounts` | Chart of accounts (deterministic UUIDs) |
| `journalEntries` | Immutable double-entry ledger |
| `customers`, `vendors` | Parties with opening balances |
| `products`, `productCategories`, `stockMovements` | Inventory |
| `sales`, `purchases`, `expenses`, `recurringExpenses` | Business documents |
| `bankAccounts`, `bankTransactions` | Cash/bank register |
| `settings` | Singleton: sequences, FY, backup prefs |
| `dashboardCache` | Computed dashboard metrics |
| `backupSnapshots` | Rolling on-device backups (max 5) |
| `backupFolder` | Optional folder for automatic backups |

---

## Backup & data safety

| Feature | How |
|---------|-----|
| **Automatic backup** | Settings → enable; daily / weekly / monthly |
| **Download JSON** | Optional with each automatic backup |
| **On-device snapshots** | Keeps last 5 backups in IndexedDB |
| **Folder backup** | Chrome/Edge — save directly to a folder you pick |
| **Manual export** | Settings → Backup now / Download JSON |
| **Restore** | Settings → Restore from file or on-device snapshot |
| **Factory reset** | Downloads a backup first, then wipes everything |

**Important:** If you uninstall the app or clear browser data, IndexedDB is gone. Keep exported `.json` files somewhere safe.

Automatic backups run on app launch, when the tab becomes visible, and hourly while the app is open.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production PWA build |
| `npm run preview` | Serve production build locally |
| `npm run typecheck` | TypeScript check only |
| `npm run gen:icons` | Regenerate PWA icons |

---

## Verification

```bash
npm run typecheck
npm run build
```

Manual smoke test (390 px viewport or installed PWA):

- [ ] Create a sale offline → reload → data persists
- [ ] Void a sale → stock and journal update correctly
- [ ] Settings → enable automatic backup → reload → snapshot appears
- [ ] Export backup → restore on fresh tab
- [ ] Banking transfer posts balanced GL entry
- [ ] Factory reset downloads backup then clears data

---

## Deployment (Vercel)

1. Import repo on Vercel.
2. Deploy — no environment variables needed.
3. [`vercel.json`](vercel.json) handles SPA rewrites and security headers.

---

## Project layout

```
src/
  lib/           db, money, accounting, transactions, reports, backup, seed
  lib/migrations/   one-time data migrations
  hooks/         live queries, settings, financials
  store/         Zustand (app, toast, theme, period)
  components/    layout, common UI, charts, forms
  pages/         route screens
public/icons/    PWA icons
scripts/         icon generation helper
```

---

## License

Private — Biswajit Power Hub. All rights reserved.
