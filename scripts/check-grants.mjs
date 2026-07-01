import pg from 'pg';

const conn = process.argv[2];
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(
  `select table_name, privilege_type
     from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public'
    order by table_name, privilege_type;`,
);
const byTable = {};
for (const r of rows) (byTable[r.table_name] ??= []).push(r.privilege_type);
for (const [t, privs] of Object.entries(byTable)) console.log(t.padEnd(20), privs.join(', '));
await client.end();
