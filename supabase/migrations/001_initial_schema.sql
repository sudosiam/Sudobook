-- Sudo Books — Supabase cloud mirror schema
-- Each table mirrors a Dexie store. The full local record is stored as JSONB
-- in `data` (drift-proof), with id + user_id for RLS and updated_at/deleted_at
-- for last-write-wins sync and soft deletes.

create extension if not exists "pgcrypto";

do $$
declare
  t text;
  tables text[] := array[
    'accounts',
    'journal_entries',
    'customers',
    'vendors',
    'products',
    'sales',
    'purchases',
    'expenses',
    'bank_accounts',
    'bank_transactions',
    'stock_movements'
  ];
begin
  foreach t in array tables loop
    execute format($f$
      create table if not exists public.%I (
        id uuid primary key,
        user_id uuid not null references auth.users (id) on delete cascade,
        data jsonb not null,
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      );
    $f$, t);
  end loop;
end $$;
