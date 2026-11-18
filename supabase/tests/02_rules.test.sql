-- Rules for create_plan / check_in / uncheck / end_plan_early / finalize.
-- The private._* functions take "now" explicitly so boundaries are exact.
-- Users:  A 1111…  B 2222…  C 3333…  D 4444…
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev', '{"full_name":"User A"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.dev', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.dev', '{}');

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'User A',
  'a profile row is created on signup'
);

-- ---------------------------------------------------------------------------
-- A: Asia/Kolkata, sleep 23:00, created 2026-01-15 15:30 IST, rest Sunday.
-- Window for 2026-01-15: 15:30:00Z .. 17:30:00Z
-- ---------------------------------------------------------------------------
select lives_ok($$
  select private.create_plan(
    '11111111-1111-1111-1111-111111111111', '2026-01-15T10:00:00Z',
    0.02, 30, '{7}', '23:00', 'Asia/Kolkata',
    '[{"title":"Static GK"},{"title":"Quant","done_criteria":"30 MCQs"}]'
  )
$$, 'A creates a plan');

select set_config('test.a_plan',
  (select id::text from public.plans where user_id = '11111111-1111-1111-1111-111111111111'), true);
select set_config('test.a_gk',
  (select id::text from public.works where title = 'Static GK'), true);
select set_config('test.a_quant',
  (select id::text from public.works where title = 'Quant'), true);

select results_eq(
  $$ select start_date, end_date, status::text from public.plans where id = current_setting('test.a_plan')::uuid $$,
  $$ values ('2026-01-15'::date, '2026-02-13'::date, 'active') $$,
  'start_date is the first day whose window has not opened; end = start + 29'
);

select results_eq(
  $$ select position::int, color_index::int, done_criteria from public.works
     where plan_id = current_setting('test.a_plan')::uuid order by position $$,
  $$ values (0, 0, null::text), (1, 1, '30 MCQs') $$,
  'works keep their order; color_index = position'
);

select throws_ok($$
  select private.create_plan(
    '11111111-1111-1111-1111-111111111111', '2026-01-15T11:00:00Z',
    0.01, 30, '{}', '23:00', 'Asia/Kolkata', '[{"title":"x"}]'
  )
$$, 'P0001', 'ACTIVE_PLAN_EXISTS', 'a second active plan is rejected');

-- Window boundaries ----------------------------------------------------------
select throws_ok($$
  select private.check_in('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_gk')::uuid, '2026-01-15T15:29:59Z')
$$, 'P0001', 'WINDOW_CLOSED', 'one second before open: rejected');

select lives_ok($$
  select private.check_in('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_gk')::uuid, '2026-01-15T15:30:00Z')
$$, 'at open: accepted');

select lives_ok($$
  select private.check_in('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_gk')::uuid, '2026-01-15T16:00:00Z')
$$, 'ticking twice is idempotent');

select is(
  (select count(*)::int from public.checkins where work_id = current_setting('test.a_gk')::uuid),
  1,
  'still exactly one checkin after a repeat tick'
);

select is(
  (select plan_day from public.checkins where work_id = current_setting('test.a_gk')::uuid),
  '2026-01-15'::date,
  'the checkin belongs to the window''s plan day'
);

select lives_ok($$
  select private.check_in('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_quant')::uuid, '2026-01-15T17:29:59Z')
$$, 'one second before close: accepted');

select throws_ok($$
  select private.check_in('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_quant')::uuid, '2026-01-15T17:30:00Z')
$$, 'P0001', 'WINDOW_CLOSED', 'at close: rejected');

select is(
  private.next_window_open(
    (select p from public.plans p where id = current_setting('test.a_plan')::uuid),
    '2026-01-15T17:30:00Z'),
  '2026-01-16T15:30:00Z'::timestamptz,
  'WINDOW_CLOSED detail: next open is tomorrow 21:00 IST'
);

-- Untick
select lives_ok($$
  select private.uncheck('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_quant')::uuid, '2026-01-15T17:00:00Z')
$$, 'untick inside the window');

select is(
  (select count(*)::int from public.checkins where plan_id = current_setting('test.a_plan')::uuid),
  1,
  'untick removed the checkin'
);

select lives_ok($$
  select private.uncheck('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_quant')::uuid, '2026-01-15T17:00:00Z')
$$, 'untick is idempotent');

select throws_ok($$
  select private.uncheck('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_gk')::uuid, '2026-01-15T18:00:00Z')
$$, 'P0001', 'WINDOW_CLOSED', 'untick outside the window is rejected');

-- Rest day: 2026-01-18 is a Sunday.
select throws_ok($$
  select private.check_in('11111111-1111-1111-1111-111111111111',
    current_setting('test.a_gk')::uuid, '2026-01-18T16:00:00Z')
$$, 'P0001', 'REST_DAY', 'ticks on a rest day are rejected');

select is(
  private.next_window_open(
    (select p from public.plans p where id = current_setting('test.a_plan')::uuid),
    '2026-01-17T17:30:00Z'),
  '2026-01-19T15:30:00Z'::timestamptz,
  'next open skips the rest day'
);

-- ---------------------------------------------------------------------------
-- B: sleep 01:00 (after midnight). Created 22:30 IST on 2026-01-15.
-- Window for 2026-01-15: 23:00 IST .. 01:00 IST next day = 17:30Z .. 19:30Z.
-- ---------------------------------------------------------------------------
select lives_ok($$
  select private.create_plan(
    '22222222-2222-2222-2222-222222222222', '2026-01-15T17:00:00Z',
    0.01, 30, '{}', '01:00', 'Asia/Kolkata', '[{"title":"Reasoning"}]'
  )
$$, 'B creates a plan with sleep 01:00');

select set_config('test.b_plan',
  (select id::text from public.plans where user_id = '22222222-2222-2222-2222-222222222222'), true);
select set_config('test.b_work',
  (select id::text from public.works where title = 'Reasoning'), true);

select is(
  (select start_date from public.plans where id = current_setting('test.b_plan')::uuid),
  '2026-01-15'::date,
  'sleep 01:00 created at 22:30: starts today'
);

select is(
  (private.check_in('22222222-2222-2222-2222-222222222222',
    current_setting('test.b_work')::uuid, '2026-01-15T19:00:00Z')).plan_day,
  '2026-01-15'::date,
  'a tick at 00:30 local belongs to the previous calendar day'
);

select throws_ok($$
  select private.check_in('22222222-2222-2222-2222-222222222222',
    current_setting('test.b_work')::uuid, '2026-01-15T19:30:00Z')
$$, 'P0001', 'WINDOW_CLOSED', 'sleep 01:00: closes at 01:00 local next day');

-- ---------------------------------------------------------------------------
-- C: created inside today's window, so the plan starts tomorrow.
-- ---------------------------------------------------------------------------
select lives_ok($$
  select private.create_plan(
    '33333333-3333-3333-3333-333333333333', '2026-01-15T16:00:00Z',
    0.03, 60, '{6,7}', '23:00', 'Asia/Kolkata', '[{"title":"English"}]'
  )
$$, 'C creates a plan during an open window');

select set_config('test.c_plan',
  (select id::text from public.plans where user_id = '33333333-3333-3333-3333-333333333333'), true);
select set_config('test.c_work',
  (select id::text from public.works where title = 'English'), true);

select is(
  (select start_date from public.plans where id = current_setting('test.c_plan')::uuid),
  '2026-01-16'::date,
  'created after today''s window opened: starts tomorrow'
);

select throws_ok($$
  select private.check_in('33333333-3333-3333-3333-333333333333',
    current_setting('test.c_work')::uuid, '2026-01-15T16:30:00Z')
$$, 'P0001', 'OUTSIDE_PLAN', 'ticks before start_date are rejected');

select throws_ok($$
  select private.check_in('11111111-1111-1111-1111-111111111111',
    current_setting('test.c_work')::uuid, '2026-01-16T16:00:00Z')
$$, 'P0001', 'WORK_NOT_FOUND', 'cannot tick another user''s work');

-- ---------------------------------------------------------------------------
-- Validation (D has no plan)
-- ---------------------------------------------------------------------------
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.05, 30, '{}', '23:00', 'Asia/Kolkata', '[{"title":"x"}]') $$,
  'P0001', 'INVALID_RATE', 'rate above the 3% cap is rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 29, '{}', '23:00', 'Asia/Kolkata', '[{"title":"x"}]') $$,
  'P0001', 'INVALID_DURATION', 'duration below 30 is rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 91, '{}', '23:00', 'Asia/Kolkata', '[{"title":"x"}]') $$,
  'P0001', 'INVALID_DURATION', 'duration above 90 is rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 30, '{1,1}', '23:00', 'Asia/Kolkata', '[{"title":"x"}]') $$,
  'P0001', 'INVALID_REST_DAYS', 'duplicate rest days are rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 30, '{1,2,3}', '23:00', 'Asia/Kolkata', '[{"title":"x"}]') $$,
  'P0001', 'INVALID_REST_DAYS', 'more than two rest days are rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 30, '{8}', '23:00', 'Asia/Kolkata', '[{"title":"x"}]') $$,
  'P0001', 'INVALID_REST_DAYS', 'rest weekday outside 1..7 is rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 30, '{}', '12:00', 'Asia/Kolkata', '[{"title":"x"}]') $$,
  'P0001', 'INVALID_SLEEP_TIME', 'sleep time outside 20:00-04:00 is rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 30, '{}', '23:00', 'Mars/Olympus', '[{"title":"x"}]') $$,
  'P0001', 'INVALID_TIMEZONE', 'unknown time zone is rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 30, '{}', '23:00', 'Asia/Kolkata', '[]') $$,
  'P0001', 'INVALID_WORKS', 'zero works is rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 30, '{}', '23:00', 'Asia/Kolkata',
  '[{"title":"1"},{"title":"2"},{"title":"3"},{"title":"4"},{"title":"5"},{"title":"6"},{"title":"7"},{"title":"8"},{"title":"9"}]') $$,
  'P0001', 'INVALID_WORKS', 'more than eight works is rejected');
select throws_ok($$ select private.create_plan('44444444-4444-4444-4444-444444444444', '2026-01-15T10:00:00Z',
  0.01, 30, '{}', '23:00', 'Asia/Kolkata', '[{"title":"   "}]') $$,
  'P0001', 'INVALID_WORK_TITLE', 'blank work titles are rejected');
select is(
  (select count(*)::int from public.plans where user_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'failed validation leaves nothing behind'
);

-- ---------------------------------------------------------------------------
-- Ending early
-- ---------------------------------------------------------------------------
select throws_ok($$ select private.end_plan_early('33333333-3333-3333-3333-333333333333',
  current_setting('test.c_plan')::uuid, 'end', '2026-01-20T00:00:00Z') $$,
  'P0001', 'CONFIRMATION_REQUIRED', 'end early needs the exact word END');
select throws_ok($$ select private.end_plan_early('11111111-1111-1111-1111-111111111111',
  current_setting('test.c_plan')::uuid, 'END', '2026-01-20T00:00:00Z') $$,
  'P0001', 'PLAN_NOT_FOUND', 'cannot end another user''s plan');
select lives_ok($$ select private.end_plan_early('33333333-3333-3333-3333-333333333333',
  current_setting('test.c_plan')::uuid, 'END', '2026-01-20T00:00:00Z') $$,
  'owner ends the plan early');
select results_eq(
  $$ select status::text, ended_at from public.plans where id = current_setting('test.c_plan')::uuid $$,
  $$ values ('ended_early', '2026-01-20T00:00:00Z'::timestamptz) $$,
  'status and ended_at are recorded'
);
select throws_ok($$ select private.check_in('33333333-3333-3333-3333-333333333333',
  current_setting('test.c_work')::uuid, '2026-01-20T16:00:00Z') $$,
  'P0001', 'PLAN_NOT_ACTIVE', 'no ticks after ending early');

-- ---------------------------------------------------------------------------
-- Finalize: B's last day is 2026-02-13, closing 2026-02-13T19:30:00Z.
-- ---------------------------------------------------------------------------
select is(private.finalize_expired_plans('2026-02-13T19:29:59Z', '22222222-2222-2222-2222-222222222222'), 0,
  'not finalized one second before the last close');
select throws_ok($$ select private.check_in('22222222-2222-2222-2222-222222222222',
  current_setting('test.b_work')::uuid, '2026-02-13T19:30:00Z') $$,
  'P0001', 'PLAN_NOT_ACTIVE', 'no ticks once the last window has closed');
select lives_ok($$
  select private.create_plan(
    '22222222-2222-2222-2222-222222222222', '2026-02-14T00:00:00Z',
    0.01, 30, '{}', '23:00', 'Asia/Kolkata', '[{"title":"Reasoning"}]'
  )
$$, 'create_plan finalizes the expired plan first, then succeeds');
select is(
  (select status::text from public.plans where id = current_setting('test.b_plan')::uuid),
  'completed',
  'the expired plan is now completed'
);

select * from finish();
rollback;
