// Simulates the app's authenticated pull: sign in, then read a table with RLS.
const url = 'https://hirbvdrrnvrkwcnofvcu.supabase.co';
const anon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcmJ2ZHJybnZya3djbm9mdmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjM2OTgsImV4cCI6MjA5ODQzOTY5OH0.TeHtUU7Ub0FScd-t9_UjjRN3Px66R94Hhlp471bF0BY';

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error('Usage: node scripts/test-pull.mjs <email> <password>');
  process.exit(1);
}

const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const auth = await signIn.json();
if (!auth.access_token) {
  console.error('Sign-in failed:', auth);
  process.exit(2);
}
console.log('Signed in as user:', auth.user?.id, auth.user?.email);

for (const t of ['expenses', 'journal_entries', 'bank_transactions', 'accounts']) {
  const res = await fetch(
    `${url}/rest/v1/${t}?select=id,updated_at,deleted_at&order=updated_at.asc`,
    { headers: { apikey: anon, Authorization: `Bearer ${auth.access_token}` } },
  );
  const rows = await res.json();
  console.log(`${t.padEnd(20)} status ${res.status} rows`, Array.isArray(rows) ? rows.length : rows);
}
