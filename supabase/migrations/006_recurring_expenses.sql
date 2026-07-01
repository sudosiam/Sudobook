-- Recurring expense templates (Dexie recurringExpenses mirror)
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

create index if not exists recurring_expenses_user_updated_idx
  on public.recurring_expenses (user_id, updated_at);

drop trigger if exists set_updated_at on public.recurring_expenses;
create trigger set_updated_at before insert or update on public.recurring_expenses
  for each row execute function public.set_updated_at();
