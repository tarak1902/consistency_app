-- Hardening from the Supabase security advisor (first hosted deploy).
--
-- 1. Pin search_path on the remaining helper functions (lint 0011).
alter function private.iso(timestamptz) set search_path = '';
alter function private.is_rest_day(date, smallint[]) set search_path = '';
alter function public.server_time() set search_path = '';

-- 2. Only the hourly pg_cron job (runs as postgres) needs to finalize plans.
--    The client derives the effective status itself.
revoke execute on function public.finalize_expired_plans() from authenticated;

-- Note (lint 0029, intentional): create_plan, check_in, uncheck and
-- end_plan_early are SECURITY DEFINER and executable by `authenticated` by
-- design. They are the only write path; each checks auth.uid() and ownership,
-- and tables grant clients SELECT only.
