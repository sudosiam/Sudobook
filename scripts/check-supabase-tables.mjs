// Verify Supabase mirror tables exist (PostgREST schema cache).
// Usage: node scripts/check-supabase-tables.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');
let url = process.env.VITE_SUPABASE_URL;
let anon = process.env.VITE_SUPABASE_ANON_KEY;

try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === 'VITE_SUPABASE_URL') url = val;
    if (key === 'VITE_SUPABASE_ANON_KEY') anon = val;
  }
} catch {
  /* use env vars if .env.local missing */
}

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const tables = [
  'accounts',
  'products',
  'product_categories',
  'recurring_expenses',
  'sales',
];

let missing = 0;
let warnings = 0;
for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=id&limit=0`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  let detail = '';
  try {
    const json = await res.json();
    detail = json.code ? `${json.code}: ${json.message}` : res.statusText;
  } catch {
    detail = res.statusText;
  }
  const exists = res.status !== 404;
  const healthy = res.ok || res.status === 401 || res.status === 403;
  if (!exists) missing++;
  if (exists && !healthy) warnings++;
  const marker = !exists ? '✗' : healthy ? '✓' : '⚠';
  console.log(`${marker} ${t.padEnd(22)} HTTP ${res.status} ${detail}`);
}

if (warnings > 0) {
  console.warn(
    `Completed with ${warnings} warning(s): tables exist, but some checks returned unexpected non-auth errors.`,
  );
}

process.exit(missing > 0 ? 1 : 0);
