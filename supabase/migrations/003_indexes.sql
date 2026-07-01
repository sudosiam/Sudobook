-- Indexes to speed up per-user pull sync (updated_at watermark) and lookups.

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
    execute format(
      'create index if not exists %I on public.%I (user_id, updated_at);',
      t || '_user_updated_idx', t
    );
  end loop;
end $$;
