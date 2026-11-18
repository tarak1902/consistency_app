-- Demo data for designing against real-looking graphs.
--   demo@compound.app (sign in with the email OTP; locally the code appears in
--   Mailpit/Inbucket at http://127.0.0.1:54324)
--   - one completed 30-day plan
--   - one active 60-day plan, 40 days in (today is day 40), relative to now()
-- The mix of complete / partial / missed / rest days is deterministic.

do $$
declare
  v_uid uuid := 'd0d0d0d0-0000-4000-8000-000000000001';
  v_tz text := 'Asia/Kolkata';
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_active_start date := (now() at time zone 'Asia/Kolkata')::date - 39;
  v_old_start date := (now() at time zone 'Asia/Kolkata')::date - 39 - 44;
  v_plan uuid;
  v_works uuid[];
  v_work uuid;
  v_titles text[];
  v_criteria text[];
  v_weak int;
  v_day date;
  v_close timestamptz;
  v_i int;
  v_h int;
  v_k int;
  v_n int;
  v_skip1 int;
  v_skip2 int;
  v_round int;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'demo@compound.app', '', now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Aspirant"}',
    now() - interval '90 days', now(), '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', 'demo@compound.app', 'email_verified', true),
    'email', now(), now(), now()
  ) on conflict do nothing;

  for v_round in 1..2 loop
    if v_round = 1 then
      -- Completed 30-day plan, 2%, rest Sunday, sleep 22:30.
      insert into public.plans (user_id, rate, duration_days, rest_weekdays, sleep_time, timezone,
                                start_date, end_date, status, created_at)
      values (v_uid, 0.02, 30, '{7}', '22:30', v_tz, v_old_start, v_old_start + 29, 'completed',
              (v_old_start - 1)::timestamp at time zone v_tz)
      returning id into v_plan;
      v_titles := array['Current affairs', 'English vocabulary', 'Reasoning', 'Quant'];
      v_criteria := array['The Hindu summary + 15 MCQs', '25 new words, revise 50', '2 puzzle sets', null];
    else
      -- Active 60-day plan, 1%, rest Sunday, sleep 23:00, today = day 40.
      insert into public.plans (user_id, rate, duration_days, rest_weekdays, sleep_time, timezone,
                                start_date, end_date, status, created_at)
      values (v_uid, 0.01, 60, '{7}', '23:00', v_tz, v_active_start, v_active_start + 59, 'active',
              (v_active_start - 1)::timestamp at time zone v_tz)
      returning id into v_plan;
      v_titles := array['Static GK', 'English reading', 'Reasoning', 'Quant'];
      v_criteria := array['1 chapter + 20 MCQs', '1 editorial, note 10 words', '1 sectional test', '30 questions, timed'];
    end if;

    v_n := cardinality(v_titles);
    v_works := array[]::uuid[];
    for v_k in 1..v_n loop
      insert into public.works (plan_id, user_id, title, done_criteria, color_index, position)
      values (v_plan, v_uid, v_titles[v_k], v_criteria[v_k], v_k - 1, v_k - 1)
      returning id into v_work;
      v_works := v_works || v_work;
    end loop;
    v_weak := v_n; -- Quant is the work that gets skipped most.

    v_i := 0;
    v_day := case when v_round = 1 then v_old_start else v_active_start end;
    while v_day <= case when v_round = 1 then v_old_start + 29 else v_active_start + 59 end loop
      v_close := (select close_at from public.plan_window(v_day, case when v_round = 1 then time '22:30' else time '23:00' end, v_tz));
      exit when v_close > now();
      if extract(isodow from v_day) <> 7 then
        v_h := (v_i * case when v_round = 1 then 37 else 53 end + case when v_round = 1 then 11 else 7 end) % 100;
        v_skip1 := case when v_i % 2 = 0 then v_weak else (v_i % (v_n - 1)) + 1 end;
        v_skip2 := case when v_h >= 76 then ((v_i + 1) % (v_n - 1)) + 1 else 0 end;
        for v_k in 1..v_n loop
          if v_h < 62
             or (v_h < 85 and v_k <> v_skip1 and v_k <> v_skip2) then
            insert into public.checkins (user_id, plan_id, work_id, plan_day, created_at)
            values (v_uid, v_plan, v_works[v_k], v_day, v_close - interval '35 minutes' + (v_k * interval '4 minutes'));
          end if;
        end loop;
      end if;
      v_i := v_i + 1;
      v_day := v_day + 1;
    end loop;
  end loop;
end;
$$;
