-- Grant base table privileges to the API roles. RLS still restricts rows to
-- the owning user; these grants only allow the role to reach the tables at all.
-- (Tables created via raw SQL don't inherit Supabase's default grants.)

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
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant select, insert, update, delete on public.%I to service_role;', t);
  end loop;
end $$;
