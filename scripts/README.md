# Scripts

Node utilities for development and ops. None are required for normal app use.

| Script | Usage | Description |
|---|---|---|
| `gen-icons.mjs` | `npm run gen:icons` | Generate PWA PNG icons → `public/icons/` |
| `run-migrations.mjs` | `node scripts/run-migrations.mjs` | Apply Supabase SQL migrations via connection string |
| `run-pending-migrations.mjs` | `node scripts/run-pending-migrations.mjs` | Apply pending migrations only |
| `inspect-cloud.mjs` | `node scripts/inspect-cloud.mjs` | Inspect cloud row counts / schema |
| `check-grants.mjs` | `node scripts/check-grants.mjs` | Verify Supabase table grants |
| `check-userids.mjs` | `node scripts/check-userids.mjs` | Audit `user_id` consistency in cloud |
| `test-pull.mjs` | `node scripts/test-pull.mjs` | Test pull-sync against Supabase |
| `roundtrip.mjs` | `node scripts/roundtrip.mjs` | Push + pull roundtrip smoke test |
| `usage.mjs` | `node scripts/usage.mjs` | Storage / table usage summary |

Migration scripts expect `SUPABASE_DB_URL` (direct Postgres connection string) in the environment — **never commit credentials**.

For manual one-off SQL, use `supabase/migrations/RUN_ME_PENDING.sql` in the Supabase Dashboard SQL Editor.
