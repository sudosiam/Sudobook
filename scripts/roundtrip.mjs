// Full pipeline test with a throwaway user: signup -> insert -> select back.
const url = 'https://hirbvdrrnvrkwcnofvcu.supabase.co';
const anon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcmJ2ZHJybnZya3djbm9mdmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjM2OTgsImV4cCI6MjA5ODQzOTY5OH0.TeHtUU7Ub0FScd-t9_UjjRN3Px66R94Hhlp471bF0BY';

const email = `test_${Date.now()}@example.com`;
const password = 'Test123456!';

const up = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const auth = await up.json();
console.log('signup status', up.status, 'has token:', !!auth.access_token, 'user:', auth.user?.id);
if (!auth.access_token) {
  console.log('No session (email confirmation likely ON). Response:', JSON.stringify(auth).slice(0, 300));
  process.exit(0);
}

const token = auth.access_token;
const headers = {
  apikey: anon,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const id = crypto.randomUUID();
const ins = await fetch(`${url}/rest/v1/customers`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ id, user_id: auth.user.id, data: { id, name: 'Roundtrip Test' } }),
});
console.log('insert status', ins.status, (await ins.text()).slice(0, 200));

const sel = await fetch(`${url}/rest/v1/customers?select=id,data,updated_at,deleted_at`, {
  headers: { apikey: anon, Authorization: `Bearer ${token}` },
});
const rows = await sel.json();
console.log('select status', sel.status, 'rows', Array.isArray(rows) ? rows.length : rows);
console.log(JSON.stringify(rows, null, 2).slice(0, 400));
