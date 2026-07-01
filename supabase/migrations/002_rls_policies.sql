-- Row Level Security: every user can only see and mutate their own rows.

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
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "own rows" on public.%I;', t);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;
