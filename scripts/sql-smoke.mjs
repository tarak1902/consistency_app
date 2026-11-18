// Docker-free SQL smoke test. Runs supabase/migrations, the pgTAP tests in
// supabase/tests (through a tiny pgTAP-compatible shim) and optionally the seed
// against PGlite (Postgres compiled to WASM) with minimal Supabase stubs
// (roles, auth.users, auth.uid()).
//
//   npm run db:smoke          # migrations + tests
//   npm run db:smoke -- seed  # migrations + seed, prints a summary
//
// The real suite is still `supabase test db` (pgTAP inside the local stack).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const db = new PGlite();
const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth;
create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz, confirmation_token text, recovery_token text, email_change_token_new text, email_change text); create table auth.identities (id uuid primary key, user_id uuid references auth.users, provider_id text, identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, unique (provider_id, provider));
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema extensions; grant usage on schema extensions to public;
create function extensions.plan(int) returns text language sql as $$ select 'plan ' || $1 $$;
create function extensions._rec(ok boolean, descr text, diag text default null) returns text language sql as $$
  select (case when ok then 'ok ' else 'not ok ' end) || descr || case when ok or diag is null then '' else '  # ' || diag end $$;
create function extensions.ok(boolean, text) returns text language sql as $$ select extensions._rec(coalesce($1,false), $2) $$;
create function extensions.is(anyelement, anyelement, text) returns text language sql as $$
  select extensions._rec($1 is not distinct from $2, $3, format('have %s want %s', $1, $2)) $$;
create function extensions.lives_ok(text, text) returns text language plpgsql as $$
begin execute $1; return extensions._rec(true, $2);
exception when others then return extensions._rec(false, $2, sqlstate || ': ' || sqlerrm); end $$;
create function extensions.throws_ok(text, text, text, text) returns text language plpgsql as $$
begin execute $1; return extensions._rec(false, $4, 'no exception');
exception when others then
  return extensions._rec(($2 is null or sqlstate = $2) and ($3 is null or sqlerrm = $3), $4, sqlstate || ': ' || sqlerrm); end $$;
create function extensions.results_eq(text, text, text) returns text language plpgsql as $$
declare a text[]; b text[];
begin
  execute format('select array_agg(t::text) from (%s) t', $1) into a;
  execute format('select array_agg(t::text) from (%s) t', $2) into b;
  return extensions._rec(a is not distinct from b, $3, format('have %s want %s', a, b));
end $$;
create function extensions.finish() returns setof text language sql as $$ select null::text where false $$;
grant execute on all functions in schema extensions to public;
alter database template1 set search_path = public, extensions;
`;
await db.exec(stub);
await db.exec(`set search_path = public, extensions; set timezone = 'UTC';`);
for (const f of readdirSync(join(root, 'supabase/migrations')).sort()) {
  await db.exec(readFileSync(join(root, 'supabase/migrations', f), 'utf8'));
  console.log('migrated', f);
}
let failed = 0;
const files =
  mode === 'seed'
    ? []
    : readdirSync(join(root, 'supabase/tests'))
        .filter((f) => f.endsWith('.sql'))
        .sort();
for (const f of files) {
  const sql = readFileSync(join(root, 'supabase/tests', f), 'utf8').replace(
    /create extension if not exists pgtap[^;]*;/,
    '',
  );
  let results;
  try {
    results = await db.exec(sql);
  } catch (e) {
    console.log(`${f}: ERROR ${e.message}`);
    failed++;
    continue;
  }
  const lines = results
    .flatMap((r) => r.rows.map((row) => Object.values(row)[0]))
    .filter((v) => typeof v === 'string');
  const planned = Number((lines.find((l) => l.startsWith('plan ')) ?? 'plan 0').slice(5));
  const tap = lines.filter((l) => l.startsWith('ok ') || l.startsWith('not ok '));
  const bad = tap.filter((l) => l.startsWith('not ok '));
  failed += bad.length + (tap.length !== planned ? 1 : 0);
  console.log(`${f}: ${tap.length - bad.length}/${tap.length} ok (planned ${planned})`);
  for (const b of bad) console.log('   ', b);
}
if (mode === 'seed') {
  await db.exec(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
  const r =
    await db.query(`select p.status, p.duration_days, p.start_date, p.end_date, count(distinct w.id) works,
     (select count(*) from checkins c where c.plan_id = p.id) checkins from plans p join works w on w.plan_id = p.id group by p.id order by p.start_date`);
  console.table(r.rows);
  const d = await db.query(
    "select x.st, count(*)::int as n from (select case when private.is_rest_day(g.dd, p.rest_weekdays) then 'rest' when (select close_at from public.plan_window(g.dd, p.sleep_time, p.timezone)) > now() then 'notclosed' else (select case when count(*) = 0 then 'missed' when count(*) = (select count(*) from works w where w.plan_id = p.id) then 'complete' else 'partial' end from checkins c where c.plan_id = p.id and c.plan_day = g.dd) end as st from plans p cross join lateral (select gs::date as dd from generate_series(p.start_date::timestamp, p.end_date::timestamp, interval '1 day') gs) g where p.status = 'active') x group by x.st order by x.st",
  );
  console.table(d.rows);
}
console.log(failed ? `FAILED (${failed})` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
