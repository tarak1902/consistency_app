-- RLS and immutability: user B can't read or write user A's data, and no
-- authenticated user can write tables directly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.dev'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.dev');

select private.create_plan('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-15T10:00:00Z',
  0.02, 30, '{}', '23:00', 'Asia/Kolkata', '[{"title":"A work"}]');
select private.create_plan('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-01-15T10:00:00Z',
  0.02, 30, '{}', '23:00', 'Asia/Kolkata', '[{"title":"B work"}]');
select private.check_in('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select id from public.works where title = 'A work'), '2026-01-15T16:00:00Z');
select private.check_in('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  (select id from public.works where title = 'B work'), '2026-01-15T16:00:00Z');

select set_config('test.a_plan', (select id::text from public.plans where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
select set_config('test.a_work', (select id::text from public.works where title = 'A work'), true);
select set_config('test.b_plan', (select id::text from public.plans where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), true);

-- Act as B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*)::int from public.plans), 1, 'B sees only their own plan');
select is((select count(*)::int from public.works), 1, 'B sees only their own works');
select is((select count(*)::int from public.checkins), 1, 'B sees only their own checkins');
select is((select count(*)::int from public.profiles), 1, 'B sees only their own profile');
select is((select count(*)::int from public.plans where id = current_setting('test.a_plan')::uuid), 0,
  'B cannot read A''s plan by id');

select throws_ok($$ update public.plans set rate = 0.03 where id = current_setting('test.b_plan')::uuid $$,
  '42501', null, 'direct update of own plan fails (plans are immutable)');
select throws_ok($$ update public.plans set status = 'completed' where id = current_setting('test.a_plan')::uuid $$,
  '42501', null, 'direct update of A''s plan fails');
select throws_ok($$ delete from public.works $$,
  '42501', null, 'direct delete of works fails');
select throws_ok($$ insert into public.checkins (user_id, plan_id, work_id, plan_day)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', current_setting('test.a_plan')::uuid,
          current_setting('test.a_work')::uuid, '2026-01-16') $$,
  '42501', null, 'direct insert of checkins fails');

select throws_ok($$ select public.check_in(current_setting('test.a_work')::uuid) $$,
  'P0001', 'WORK_NOT_FOUND', 'B cannot tick A''s work through the RPC');
select throws_ok($$ select public.uncheck(current_setting('test.a_work')::uuid) $$,
  'P0001', 'WORK_NOT_FOUND', 'B cannot untick A''s work through the RPC');
select throws_ok($$ select public.end_plan_early(current_setting('test.a_plan')::uuid, 'END') $$,
  'P0001', 'PLAN_NOT_FOUND', 'B cannot end A''s plan');
select throws_ok($$ select private.check_in('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', current_setting('test.a_work')::uuid, now()) $$,
  '42501', null, 'private functions are not callable by clients');

reset role;

-- Anonymous users read nothing.
set local role anon;
select throws_ok($$ select count(*) from public.plans $$,
  '42501', null, 'anon cannot read plans');
reset role;

select * from finish();
rollback;
