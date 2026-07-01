import pg from 'pg';

const conn = process.argv[2];
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();

const tables = [
  'accounts', 'journal_entries', 'customers', 'vendors', 'products',
  'sales', 'purchases', 'expenses', 'bank_accounts', 'bank_transactions', 'stock_movements',
];

for (const t of tables) {
  const { rows } = await client.query(
    `select count(*)::int as n, max(updated_at) as latest, count(distinct user_id)::int as users
       from public.${t};`,
  );
  const r = rows[0];
  console.log(t.padEnd(20), 'rows:', String(r.n).padEnd(5), 'users:', String(r.users).padEnd(3), 'latest:', r.latest ?? '-');
}

const { rows: users } = await client.query(
  `select id, email, created_at from auth.users order by created_at;`,
);
console.log('\nAuth users:');
for (const u of users) console.log(' ', u.id, u.email);

await client.end();
