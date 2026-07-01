-- Run once in Supabase Dashboard → SQL Editor → New query → Run
-- Creates recurring_expenses + product_categories (required for cloud sync).
-- Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS).

-- ─── recurring_expenses ───────────────────────────────────────
create table if not exists public.recurring_expenses (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.recurring_expenses enable row level security;
drop policy if exists "own rows" on public.recurring_expenses;
create policy "own rows" on public.recurring_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.recurring_expenses to authenticated;
grant select, insert, update, delete on public.recurring_expenses to service_role;

drop trigger if exists set_updated_at on public.recurring_expenses;
create trigger set_updated_at before insert or update on public.recurring_expenses
  for each row execute function public.set_updated_at();

-- ─── product_categories ───────────────────────────────────────
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
