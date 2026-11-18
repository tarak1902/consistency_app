-- Compound: initial schema.
-- All writes go through SECURITY DEFINER functions. Clients can only SELECT
-- their own rows. Time authority is the database clock (now()).
--
-- Public RPCs are thin wrappers around private._* functions that take the
-- user id and "now" explicitly, so pgTAP tests can pin the clock.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Types and tables
-- ---------------------------------------------------------------------------

create type public.plan_status as enum ('active', 'completed', 'ended_early');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  rate numeric(3, 2) not null check (rate in (0.01, 0.02, 0.03)),
  duration_days int not null check (duration_days between 30 and 90),
  rest_weekdays smallint[] not null default '{}',
  sleep_time time not null,
  timezone text not null,
  start_date date not null,
  end_date date not null,
  status public.plan_status not null default 'active',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date = start_date + duration_days - 1),
  check ((status = 'ended_early') = (ended_at is not null))
);
create unique index one_active_plan on public.plans (user_id) where status = 'active';
create index plans_user_id_idx on public.plans (user_id);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  done_criteria text check (done_criteria is null or char_length(done_criteria) <= 120),
  color_index smallint not null check (color_index between 0 and 7),
  position smallint not null,
  unique (plan_id, position)
);
create index works_user_id_idx on public.works (user_id);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan_id uuid not null references public.plans on delete cascade,
  work_id uuid not null references public.works on delete cascade,
  plan_day date not null,
  created_at timestamptz not null default now(),
  unique (work_id, plan_day)
);
create index checkins_user_id_idx on public.checkins (user_id);
create index checkins_plan_day_idx on public.checkins (plan_id, plan_day);

-- ---------------------------------------------------------------------------
-- Row Level Security: read-only, own rows.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.works enable row level security;
alter table public.checkins enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "plans: read own" on public.plans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "works: read own" on public.works
  for select to authenticated using (user_id = (select auth.uid()));
create policy "checkins: read own" on public.checkins
  for select to authenticated using (user_id = (select auth.uid()));

-- Belt and braces: with no write policies RLS already blocks writes, but a
-- blocked UPDATE silently affects 0 rows. Revoking the privilege makes any
-- direct write fail loudly (42501).
revoke insert, update, delete, truncate on public.profiles, public.plans, public.works, public.checkins
  from anon, authenticated;
revoke all on public.profiles, public.plans, public.works, public.checkins from anon;
grant select on public.profiles, public.plans, public.works, public.checkins to authenticated;

-- ---------------------------------------------------------------------------
-- Profile on signup
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Time helpers. Must match src/domain/time.ts exactly.
-- ---------------------------------------------------------------------------

-- close(D) = D 12:00 local + ((sleep − 12:00) mod 24h); open(D) = close(D) − 2h.
-- Local → instant uses AT TIME ZONE, so DST gaps/overlaps follow Postgres rules.
create function public.plan_window(
  p_day date,
  p_sleep time,
  p_tz text,
  out open_at timestamptz,
  out close_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select c - interval '2 hours', c
  from (
    select ((p_day + case when p_sleep >= time '12:00' then 0 else 1 end) + p_sleep)
      at time zone p_tz as c
  ) s;
$$;

create function private.is_rest_day(p_day date, p_rest smallint[])
returns boolean
language sql
immutable
as $$
  select extract(isodow from p_day)::smallint = any (coalesce(p_rest, '{}'));
$$;

-- The plan day whose window contains p_at (local date, then local date − 1).
create function private.plan_day_at(p_at timestamptz, p_sleep time, p_tz text)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  v_local date := (p_at at time zone p_tz)::date;
  v_day date;
  w record;
begin
  foreach v_day in array array[v_local, v_local - 1] loop
    select * into w from public.plan_window(v_day, p_sleep, p_tz);
    if w.open_at <= p_at and p_at < w.close_at then
      return v_day;
    end if;
  end loop;
  return null;
end;
$$;

-- First plan day whose window has not yet opened at p_at.
create function private.start_date_for(p_at timestamptz, p_sleep time, p_tz text)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  v_local date := (p_at at time zone p_tz)::date;
  v_day date;
begin
  for i in -1..3 loop
    v_day := v_local + i;
    if (public.plan_window(v_day, p_sleep, p_tz)).open_at > p_at then
      return v_day;
    end if;
  end loop;
  return v_local + 1;
end;
$$;

-- Next window open (non-rest, inside the plan) strictly after p_at.
create function private.next_window_open(p_plan public.plans, p_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_day date := greatest(p_plan.start_date, (p_at at time zone p_plan.timezone)::date - 1);
  v_open timestamptz;
begin
  while v_day <= p_plan.end_date loop
    if not private.is_rest_day(v_day, p_plan.rest_weekdays) then
      v_open := (public.plan_window(v_day, p_plan.sleep_time, p_plan.timezone)).open_at;
      if v_open > p_at then
        return v_open;
      end if;
    end if;
    v_day := v_day + 1;
  end loop;
  return null;
end;
$$;

create function private.iso(p_at timestamptz)
returns text
language sql
immutable
as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
$$;

-- ---------------------------------------------------------------------------
-- Plan lifecycle
-- ---------------------------------------------------------------------------

create function private.finalize_expired_plans(p_at timestamptz, p_user uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.plans p
     set status = 'completed'
   where p.status = 'active'
     and (p_user is null or p.user_id = p_user)
     and p_at >= (public.plan_window(p.end_date, p.sleep_time, p.timezone)).close_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.finalize_expired_plans()
returns integer
language sql
security definer
set search_path = public
as $$
  select private.finalize_expired_plans(now(), null);
$$;

create function private.create_plan(
  p_uid uuid,
  p_at timestamptz,
  p_rate numeric,
  p_duration_days integer,
  p_rest_weekdays smallint[],
  p_sleep_time time,
  p_timezone text,
  p_works jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest smallint[] := coalesce(p_rest_weekdays, '{}');
  v_sleep time := date_trunc('minute', p_sleep_time::interval)::time;
  v_start date;
  v_plan_id uuid;
  v_work jsonb;
  v_pos integer := 0;
  v_title text;
  v_criteria text;
begin
  if p_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  perform private.finalize_expired_plans(p_at, p_uid);

  if exists (select 1 from public.plans where user_id = p_uid and status = 'active') then
    raise exception 'ACTIVE_PLAN_EXISTS' using errcode = 'P0001';
  end if;

  if p_rate is null or p_rate not in (0.01, 0.02, 0.03) then
    raise exception 'INVALID_RATE' using errcode = 'P0001';
  end if;

  if p_duration_days is null or p_duration_days not between 30 and 90 then
    raise exception 'INVALID_DURATION' using errcode = 'P0001';
  end if;

  if cardinality(v_rest) > 2
     or exists (select 1 from unnest(v_rest) d where d is null or d not between 1 and 7)
     or (select count(distinct d) from unnest(v_rest) d) <> cardinality(v_rest) then
    raise exception 'INVALID_REST_DAYS' using errcode = 'P0001';
  end if;

  if v_sleep is null or not (v_sleep >= time '20:00' or v_sleep <= time '04:00') then
    raise exception 'INVALID_SLEEP_TIME' using errcode = 'P0001';
  end if;

  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = 'P0001';
  end if;

  if p_works is null or jsonb_typeof(p_works) <> 'array'
     or jsonb_array_length(p_works) not between 1 and 8 then
    raise exception 'INVALID_WORKS' using errcode = 'P0001';
  end if;

  v_start := private.start_date_for(p_at, v_sleep, p_timezone);

  insert into public.plans (
    user_id, rate, duration_days, rest_weekdays, sleep_time, timezone, start_date, end_date, created_at
  ) values (
    p_uid, p_rate, p_duration_days,
    (select coalesce(array_agg(d order by d), '{}') from unnest(v_rest) d),
    v_sleep, p_timezone, v_start, v_start + p_duration_days - 1, p_at
  )
  returning id into v_plan_id;

  for v_work in select value from jsonb_array_elements(p_works) loop
    v_title := btrim(coalesce(v_work ->> 'title', ''));
    v_criteria := nullif(btrim(coalesce(v_work ->> 'done_criteria', '')), '');
    if char_length(v_title) not between 1 and 40 then
      raise exception 'INVALID_WORK_TITLE' using errcode = 'P0001', detail = v_pos::text;
    end if;
    if v_criteria is not null and char_length(v_criteria) > 120 then
      raise exception 'INVALID_DONE_CRITERIA' using errcode = 'P0001', detail = v_pos::text;
    end if;
    insert into public.works (plan_id, user_id, title, done_criteria, color_index, position)
    values (v_plan_id, p_uid, v_title, v_criteria, v_pos, v_pos);
    v_pos := v_pos + 1;
  end loop;

  return v_plan_id;
end;
$$;

create function public.create_plan(
  p_rate numeric,
  p_duration_days integer,
  p_rest_weekdays smallint[],
  p_sleep_time time,
  p_timezone text,
  p_works jsonb
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select private.create_plan(
    auth.uid(), now(), p_rate, p_duration_days, p_rest_weekdays, p_sleep_time, p_timezone, p_works
  );
$$;

-- Resolve and validate the target plan day for a tick/untick at p_at.
create function private.resolve_checkin_target(
  p_uid uuid,
  p_work_id uuid,
  p_at timestamptz,
  out o_work public.works,
  out o_plan public.plans,
  out o_day date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next timestamptz;
begin
  if p_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into o_work from public.works where id = p_work_id;
  if not found or o_work.user_id <> p_uid then
    raise exception 'WORK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into o_plan from public.plans where id = o_work.plan_id;
  if o_plan.status <> 'active'
     or p_at >= (public.plan_window(o_plan.end_date, o_plan.sleep_time, o_plan.timezone)).close_at then
    raise exception 'PLAN_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  o_day := private.plan_day_at(p_at, o_plan.sleep_time, o_plan.timezone);
  v_next := private.next_window_open(o_plan, p_at);

  if o_day is null then
    raise exception 'WINDOW_CLOSED' using errcode = 'P0001', detail = coalesce(private.iso(v_next), '');
  end if;
  if o_day < o_plan.start_date or o_day > o_plan.end_date then
    raise exception 'OUTSIDE_PLAN' using errcode = 'P0001', detail = coalesce(private.iso(v_next), '');
  end if;
  if private.is_rest_day(o_day, o_plan.rest_weekdays) then
    raise exception 'REST_DAY' using errcode = 'P0001', detail = coalesce(private.iso(v_next), '');
  end if;
end;
$$;

create function private.check_in(p_uid uuid, p_work_id uuid, p_at timestamptz)
returns public.checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  v_row public.checkins;
begin
  select * into t from private.resolve_checkin_target(p_uid, p_work_id, p_at);

  insert into public.checkins (user_id, plan_id, work_id, plan_day, created_at)
  values (p_uid, (t.o_plan).id, p_work_id, t.o_day, p_at)
  on conflict (work_id, plan_day) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.checkins where work_id = p_work_id and plan_day = t.o_day;
  end if;
  return v_row;
end;
$$;

create function private.uncheck(p_uid uuid, p_work_id uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  select * into t from private.resolve_checkin_target(p_uid, p_work_id, p_at);
  delete from public.checkins where work_id = p_work_id and plan_day = t.o_day;
end;
$$;

create function public.check_in(p_work_id uuid)
returns public.checkins
language sql
security definer
set search_path = public
as $$
  select * from private.check_in(auth.uid(), p_work_id, now());
$$;

create function public.uncheck(p_work_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select private.uncheck(auth.uid(), p_work_id, now());
$$;

create function private.end_plan_early(p_uid uuid, p_plan_id uuid, p_confirm text, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
begin
  if p_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_confirm is distinct from 'END' then
    raise exception 'CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  perform private.finalize_expired_plans(p_at, p_uid);

  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found or v_plan.user_id <> p_uid then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_plan.status <> 'active' then
    raise exception 'PLAN_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  update public.plans set status = 'ended_early', ended_at = p_at where id = p_plan_id;
end;
$$;

create function public.end_plan_early(p_plan_id uuid, p_confirm text)
returns void
language sql
security definer
set search_path = public
as $$
  select private.end_plan_early(auth.uid(), p_plan_id, p_confirm, now());
$$;

create function public.server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
revoke execute on function
  public.create_plan(numeric, integer, smallint[], time, text, jsonb),
  public.check_in(uuid),
  public.uncheck(uuid),
  public.end_plan_early(uuid, text),
  public.finalize_expired_plans(),
  public.plan_window(date, time, text),
  public.server_time()
from public, anon;

grant execute on function
  public.create_plan(numeric, integer, smallint[], time, text, jsonb),
  public.check_in(uuid),
  public.uncheck(uuid),
  public.end_plan_early(uuid, text),
  public.finalize_expired_plans(),
  public.plan_window(date, time, text),
  public.server_time()
to authenticated;
grant execute on function public.server_time() to anon;

-- ---------------------------------------------------------------------------
-- Realtime: plans and checkins changes reach the user's other devices.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.plans, public.checkins;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hourly finalize job (pg_cron, if available on this instance).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('finalize-expired-plans', '7 * * * *', 'select public.finalize_expired_plans()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end;
$$;
