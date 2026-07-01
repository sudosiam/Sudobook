// One-off migration runner. Applies supabase/migrations/*.sql in order.
// Usage: node scripts/run-migrations.mjs "<postgres-connection-string>"
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../supabase/migrations');

const conn = process.argv[2];
if (!conn) {
  console.error('Provide a Postgres connection string as the first argument.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

try {
  await client.connect();
  console.log('Connected. Applying', files.length, 'migrations…');
  for (const f of files) {
    const sql = readFileSync(path.join(dir, f), 'utf8');
    console.log('→', f);
    await client.query(sql);
  }
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name;",
  );
  console.log('Public tables:', rows.map((r) => r.table_name).join(', '));
  console.log('✓ Migrations applied.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(2);
} finally {
  await client.end();
}
