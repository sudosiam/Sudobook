// Apply only the pending Supabase migrations (006 + 007).
// Safe to re-run — all statements use IF NOT EXISTS / IF EXISTS guards.
//
// Usage:
//   node scripts/run-pending-migrations.mjs "<postgres-connection-string>"
//
// Get the connection string from Supabase Dashboard → Project Settings → Database
// → Connection string → URI (use the database password you set at project creation).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../supabase/migrations');

const conn = process.argv[2];
if (!conn) {
  console.error('Usage: node scripts/run-pending-migrations.mjs "<postgres-connection-string>"');
  console.error('');
  console.error('Supabase Dashboard → Project Settings → Database → Connection string → URI');
  process.exit(1);
}

const pending = ['006_recurring_expenses.sql', '007_product_categories.sql'];
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('Connected. Applying pending migrations…');
  for (const f of pending) {
    const sql = readFileSync(path.join(dir, f), 'utf8');
    console.log('→', f);
    await client.query(sql);
  }

  const { rows } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('product_categories', 'recurring_expenses')
    order by table_name;
  `);
  console.log('Verified tables:', rows.map((r) => r.table_name).join(', ') || '(none found)');
  console.log('✓ Pending migrations applied.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(2);
} finally {
  await client.end();
}
