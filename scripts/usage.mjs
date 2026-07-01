import pg from 'pg';

const conn = process.argv[2];
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: db } = await client.query(
  `select pg_size_pretty(pg_database_size(current_database())) as size,
          pg_database_size(current_database()) as bytes;`,
);
console.log('Total DB size:', db[0].size, `(${db[0].bytes} bytes)`);

const tables = [
  'accounts', 'journal_entries', 'customers', 'vendors', 'products',
  'sales', 'purchases', 'expenses', 'bank_accounts', 'bank_transactions', 'stock_movements',
];

let totalRows = 0;
console.log('\nPer table:');
for (const t of tables) {
  const { rows } = await client.query(
    `select count(*)::int n, pg_size_pretty(pg_total_relation_size('public.${t}')) size from public.${t};`,
  );
  totalRows += rows[0].n;
  console.log('  ', t.padEnd(20), 'rows:', String(rows[0].n).padEnd(4), 'size:', rows[0].size);
}
console.log('\nTotal app rows:', totalRows);

await client.end();
