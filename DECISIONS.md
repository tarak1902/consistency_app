# Decisions and assumptions (iteration 1)

Calls made while building without stopping to ask. Each one says what was
decided and why. Change any of them freely.

## Platform and libraries

1. **Expo SDK 58** (latest stable on npm at build time): React Native 0.88, React 19.3,
   TypeScript 6.0. All native packages were installed with `npx expo install` for
   SDK-matched versions. `expo-doctor` passes 20/20.
2. **victory-native 42.0.1, not 43.** v43 depends on a renamed, unscoped
   `react-native-skia` package, which would install a second Skia native module
   alongside Expo's pinned `@shopify/react-native-skia`. v42 uses the Expo-pinned
   Skia. Revisit when Expo's SDK pins the new package.
3. **Routes live in root `app/`** as the spec's structure says (the SDK 58 template
   defaults to `src/app/`).
4. **Persisted query cache uses AsyncStorage**, not MMKV, to avoid another native
   module. It is throttled, has a 7-day max age, and is busted by the app version.
5. **Session storage:** a SecureStore adapter that splits values into ~1.8 KB chunks,
   because SecureStore caps values near 2 KB and sessions can exceed that.
6. **Drag to reorder works** uses React Native's `PanResponder`. gesture-handler v3
   has a brand-new hook API, so I avoided depending on it directly; victory-native
   still uses its legacy API, which v3 keeps. Screen-reader users get
   "Move up / Move down" actions instead of dragging.
7. **Only the three Inter weights used** (400/500/600) are bundled. Importing the
   package index would ship all 18 font files (~6 MB).
8. **React Compiler is not enabled.** Its lint rules are on, and the code passes
   them. One file (`WorkListEditor.tsx`) has a scoped, commented disable for a
   PanResponder false positive.

## Time and scoring

9. **Local time → instant follows Postgres `AT TIME ZONE` rules.** A wall time inside a
   spring-forward gap uses the offset from just _before_ the transition. An ambiguous
   wall time in a fall-back overlap uses the offset from just _after_ it.
   `zonedWallToInstant` in `time.ts` implements this explicitly. The shared vectors
   cover both cases (America/New_York, March and November 2026), and the SQL produces
   identical results on PGlite.
10. **UTC offsets are computed with `Intl.DateTimeFormat#formatToParts`**, with
    `@date-fns/tz`'s `tzOffset` as a fallback. `tzOffset` relies on the `longOffset`
    time-zone-name style, which Hermes may not support.
11. **The day "Today" talks about:** the day whose window is currently open, otherwise
    the local calendar date. With a sleep time after midnight, once the window closes
    at, say, 01:00, Today moves to the new date (pending) rather than continuing to
    show the previous day's closed state. You can't tick at that point anyway, and
    Progress shows the result.
12. **Rest days that haven't closed yet already report status `rest`**, since nothing
    can be ticked on them. They don't count toward scores either way.
13. **Every series starts with a day-0 point at 100**, so a chart has a visible
    starting point from the first closed day.
14. **Streaks** count back from the latest _closed_ non-rest day. Today's open window
    never breaks or extends a streak until it closes.
15. **The stakes preview** uses the overall score after all closed days, and appears
    while today is pending or open and not every work is ticked. Per-work stakes are
    also computed, but the UI shows only the overall pair, to keep the row calm.
16. **The rate cards in the wizard** show the multiplier over the plan's _active_
    (non-rest) days, which is the true "perfect days" count. With no rest days this
    equals the duration.
17. **Effective status** is derived on the client (`completed` once
    `now ≥ close(end_date)`), so the UI is right even before the hourly cron job runs.
    A plan shows in History as soon as it is effectively no longer active.

## Database

18. **RPC logic lives in `private.*` functions that take `uid` and `now` as
    parameters.** The public functions are thin `SECURITY DEFINER` wrappers that pass
    `auth.uid()` and `now()`. This lets pgTAP test exact window boundaries
    (one second before open, at open, and so on), which `now()` alone can't do.
    The `private` schema is not exposed by PostgREST, and clients can't execute it.
19. **`plan_window` returns `(open_at, close_at)`**, not `(open, close)`, because
    `OPEN` and `CLOSE` are PL/pgSQL statement keywords and would make callers fragile.
20. **Direct writes fail loudly.** Besides RLS having no write policies, `INSERT`,
    `UPDATE` and `DELETE` privileges are revoked from `anon` and `authenticated`. A
    blocked RLS update would otherwise "succeed" with 0 rows. Now it raises `42501`,
    which the immutability test asserts.
21. **Error codes:** the spec's codes, plus `WORK_NOT_FOUND`, `PLAN_NOT_FOUND`,
    `PLAN_NOT_ACTIVE`, `CONFIRMATION_REQUIRED`, `NOT_AUTHENTICATED` and one
    `INVALID_*` code per validation. All are mapped to copy in `src/data/errors.ts`.
    `WINDOW_CLOSED`, `OUTSIDE_PLAN` and `REST_DAY` carry the next window's open time
    (ISO, UTC) in `details`.
22. **`check_in` is idempotent** and returns the existing row on a repeat tick.
    `uncheck` is idempotent too.
23. **`create_plan` normalizes its input:** sleep time truncated to the minute, titles
    trimmed, empty done-criteria stored as `NULL`, rest weekdays sorted, `created_at`
    pinned to the same `now()` used for `start_date`. Table constraints also enforce
    `end_date = start_date + duration − 1` and "ended_at is set iff ended early".
24. **Ticking after the last window closes** raises `PLAN_NOT_ACTIVE`, even if the
    hourly job hasn't marked the plan `completed` yet.
25. **The seed is relative to `now()`**, so the active plan is always on day 40 whenever
    you run `supabase db reset`. The mix is deterministic: about 60% complete, 25%
    partial, 15% missed, with Sundays as rest days. Quant is the most-skipped work,
    which gives the Results sentence something to say.
26. **`supabase/config.toml` was written by hand**, since the Supabase CLI and Docker
    weren't available at first. `database.types.ts` is now generated from the hosted
    project (`supabase gen types typescript --linked`).
    26a. **Hosted project:** `Compound1` (`wjdmksywazqfgpkkzrba`), region Mumbai
    (ap-south-1), close to Indian users. Both migrations are applied,
    `delete-account` is deployed, the cron job and Realtime publication are
    verified, and window times match the shared vectors. An earlier Tokyo project
    (`hdavtaqoipexfoynnmbf`) got the same deploy first and is no longer used by the app.
    26b. **Advisor warnings left on purpose:** `create_plan`, `check_in`, `uncheck` and
    `end_plan_early` are SECURITY DEFINER functions that signed-in users can execute
    (lint 0029). They are the only write path, and each one checks `auth.uid()` and
    ownership. Every other advisor finding was fixed in `20261118000100_hardening.sql`.
27. **The SQL was verified on PGlite** (Postgres 17 in WASM), using a small
    pgTAP-compatible shim and Supabase stubs: `npm run db:smoke`, 105/105 assertions.
    The tests are standard pgTAP files, so `supabase test db` runs them unchanged.
    That is still the authoritative run.
28. **Realtime DELETE events** can't be filtered by column (a Supabase limitation),
    and carry only the primary key. The client subscribes to them unfiltered and only
    reacts when the id matches a cached check-in.

## Product and UX

29. **Onboarding comes before sign-in** and is remembered per device (AsyncStorage).
30. **Sleep-time picker:** hour chips (8 PM to 4 AM) and minute chips in 15-minute steps.
    It's simpler and more accessible than a wheel, and the allowed range stays obvious.
    04:00 is the latest allowed time, so only :00 is offered at 4 AM.
31. **Notifications** are local only, for a rolling 14 days. iOS caps pending
    notifications at 64. The app cancels and rebuilds all of them on plan changes,
    after each tick, and on foreground. Permission is requested at the end of the
    wizard, or when a toggle is turned on in Settings.
32. **Hold-to-lock haptics:** rigid ticks while holding, rigid on completion, and the
    `success` haptic only once the server confirms the plan was created.
33. **Accessibility contrast:** the spec's `text3` grey measures 3.0–4.1:1, and the
    light-theme growth/decline/caution colors measure 3.2–4.5:1. All of these are
    below 4.5:1 for normal text. I added `textMuted` and `growthInk`/`declineInk`/`cautionInk`
    tokens (≥ 4.5:1 on every surface) for _text_. The spec colors are unchanged for
    fills, lines, dots and icons. In dark mode the inks equal the spec colors.
    Destructive buttons use `declineInk`, which gives white-on-red 5.7:1 in light mode.
34. **The `/dev/ui` gallery** is reachable from Settings in dev builds only, and
    redirects home in release builds.
35. **The bundle ID / package is `app.compound.consistency`, and the URL scheme is
    `compound`.** `APP_NAME` lives in `src/lib/config.ts`. A copy sits in
    `app.config.ts`, because that file is evaluated in Node.
36. **Account deletion:** the Edge Function verifies the JWT with `auth.getUser(jwt)`
    using the service role, then calls `auth.admin.deleteUser`. All data goes by
    `ON DELETE CASCADE`.
37. **Sentry** initializes only when a DSN is set, and stays disabled in `__DEV__`.
38. **Settings shows the name** from `profiles.display_name`, falling back to auth
    metadata. Editing the name isn't in iteration 1, because profiles have no client
    write path.
