-- Server-owned updated_at: a single authoritative clock for sync watermarks.
-- Without this, each device stamps updated_at with its own (possibly skewed)
-- clock, which breaks the incremental pull watermark across devices.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

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
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before insert or update on public.%I
         for each row execute function public.set_updated_at();',
      t
    );
    -- Re-stamp existing rows to the server clock so watermarks are consistent.
    execute format('update public.%I set updated_at = now();', t);
  end loop;
end $$;
