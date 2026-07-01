# Supabase (cloud sync)

Sudo Books uses Supabase as an **optional cloud backup**. IndexedDB (Dexie) is always the source of truth on device.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Enable **Email** auth (or your preferred provider) — sync requires an authenticated user.
3. Apply migrations **in order**:

   | File | Purpose |
   |---|---|
   | `001_initial_schema.sql` | Core JSONB mirror tables |
   | `002_rls_policies.sql` | Row Level Security (per `user_id`) |
   | `003_indexes.sql` | Pull-sync indexes on `updated_at` |
   | `004_grants.sql` | `authenticated` / `service_role` grants |
   | `005_updated_at_trigger.sql` | Auto `updated_at` on write |
   | `006_recurring_expenses.sql` | `recurring_expenses` table |
   | `006_007_pending_tables.sql` | Combined 006+007 for one-shot apply |
   | `007_product_categories.sql` | `product_categories` table |

   **Existing deployments** that never ran 006/007: paste and run `RUN_ME_PENDING.sql` once in the SQL Editor (idempotent).

4. Copy project URL + anon key to `.env.local` (see root `.env.example`).

## Schema pattern

Each synced table follows:

```sql
id uuid primary key,
user_id uuid not null references auth.users (id),
data jsonb not null,          -- full Dexie record
updated_at timestamptz,
deleted_at timestamptz          -- soft delete for sync
```

RLS policy: `auth.uid() = user_id` on all operations.

## Backup

`.github/workflows/backup.yml` runs a weekly `pg_dump` when `SUPABASE_DB_URL` is configured as a GitHub secret.

## Local migration scripts

See [../scripts/README.md](../scripts/README.md) for `run-migrations.mjs` and inspection tools.
