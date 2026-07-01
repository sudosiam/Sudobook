import pg from 'pg';

const conn = process.argv[2];
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();

const tables = ['journal_entries', 'expenses', 'bank_transactions'];
for (const t of tables) {
  const { rows } = await client.query(
    `select user_id, count(*)::int n, min(updated_at) oldest, max(updated_at) newest
       from public.${t} group by user_id;`,
  );
  console.log(`\n${t}:`);
  for (const r of rows) console.log('  user_id:', r.user_id, 'n:', r.n, 'newest:', r.newest);
}

// Show a sample row so we can see the data shape and deleted_at
const { rows: sample } = await client.query(
  `select id, user_id, deleted_at, updated_at, data from public.expenses order by updated_at desc limit 1;`,
);
console.log('\nSample expense row:');
console.log(JSON.stringify(sample[0], null, 2));

await client.end();
