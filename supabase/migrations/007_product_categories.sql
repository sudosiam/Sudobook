-- Product categories (Dexie productCategories mirror) — lets the owner manage
-- custom inventory categories (replacing the old fixed 5-value enum) and
-- auto-generate per-category SKUs, synced across devices like every other table.
create table if not exists public.product_categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.product_categories enable row level security;
drop policy if exists "own rows" on public.product_categories;
create policy "own rows" on public.product_categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.product_categories to authenticated;
grant select, insert, update, delete on public.product_categories to service_role;

create index if not exists product_categories_user_updated_idx
  on public.product_categories (user_id, updated_at);

drop trigger if exists set_updated_at on public.product_categories;
create trigger set_updated_at before insert or update on public.product_categories
  for each row execute function public.set_updated_at();

-- Fix: 006_recurring_expenses.sql enabled RLS on recurring_expenses and
-- dropped the "own rows" policy but never recreated it, which means Postgres
-- denies ALL access by default (RLS enabled + zero policies = zero rows for
-- anyone). Every push of a recurring expense to the cloud has been silently
-- failing (retried 3x, then marked 'failed') since that migration ran.
-- Guarded with to_regclass so this migration is safe to run even if
-- 006_recurring_expenses.sql hasn't been applied yet (run 006 first!).
do $$
begin
  if to_regclass('public.recurring_expenses') is not null then
    execute 'drop policy if exists "own rows" on public.recurring_expenses';
    execute 'create policy "own rows" on public.recurring_expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);';
  end if;
end $$;
