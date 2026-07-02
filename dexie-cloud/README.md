# Dexie Cloud setup (Sudo Books)

Sudo Books uses **Dexie Cloud** for optional cloud backup and multi-device sync. The app works fully offline without it.

## Free tier

Dexie Cloud **Free (SaaS)** is **$0 forever** for up to **3 production users** and **100 MB** storage — enough for a solo-owner accounting PWA.

## One-time setup

### 1. Create a cloud database

```bash
npm install
npx dexie-cloud create
```

Follow the prompts. You will get a database URL like `https://xxxxx.dexie.cloud`.

### 2. Configure the app

Copy `.env.example` → `.env.local`:

```env
VITE_DEXIE_CLOUD_URL=https://your-database.dexie.cloud
```

Restart the dev server.

### 3. Whitelist your domain (production)

```bash
npx dexie-cloud whitelist https://your-app.vercel.app
```

For local dev, `http://localhost:5173` is usually allowed by default.

### 4. Sign in inside the app

**Settings → Cloud Account → Sign In with Email**

Dexie Cloud sends a one-time code (OTP) to your email. No password to manage.

## How sync works

| Scenario | Behavior |
|----------|----------|
| Offline, not signed in | All data stays in IndexedDB on this device |
| Offline, signed in | Changes queue locally; sync when back online |
| Sign in with existing local data | Local books upload to your cloud account |
| Second device | Sign in with same email → cloud data downloads |
| Sign out | **This device is cleared** and re-seeded empty; cloud data remains |

**Local-only tables** (never uploaded): `settings`, `dashboardCache`, `backupSnapshots` — device preferences and backups stay on-device.

## Migrating from Supabase (v3.x)

Supabase sync was removed in **v4.0.0**. Existing local Dexie data is kept when you upgrade. After configuring Dexie Cloud and signing in, your local records sync to the new cloud automatically.

Old Supabase cloud data is **not** migrated automatically. Export a JSON backup from the device that has the latest books, then restore after signing in to Dexie Cloud if needed.

## Troubleshooting

- **“Cloud sync not configured”** — add `VITE_DEXIE_CLOUD_URL` to `.env.local` and rebuild.
- **Sync stuck** — Settings → Sync → **Sync Now** (requires online + signed in).
- **Sign out warning** — signing out wipes this device by design; ensure sync completed first.

Docs: [dexie.org/cloud](https://dexie.org/cloud)
