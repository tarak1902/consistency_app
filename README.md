# Compound

A small, honest consistency tracker. You pick a fixed set of daily works and a
compounding rate (1%, 2% or 3%), and the plan locks for 30 to 90 days. You can
tick works only during the 2 hours before your sleep time, and the server's
clock decides when that is. Each work has its own compounding score, and a
strict all-or-nothing day score shows that doing 3 of 4 is still a down day.

- **App:** Expo SDK 58 (React Native 0.88, React 19), TypeScript strict, expo-router
- **Backend:** Supabase (Postgres, Auth, RLS, RPC functions, Realtime, one Edge Function)
- **Spec:** `spec.md.txt`. Assumptions and deviations: [`DECISIONS.md`](DECISIONS.md)

## Repository map

```
app/                      expo-router routes
  (auth)/                 sign-in, email, verify (6-digit OTP)
  (tabs)/                 today, progress, history
  onboarding.tsx          3 slides, shown once
  plan/new.tsx            6-step create wizard (hold to lock)
  plan/[id].tsx           read-only plan detail + end early
  results/[id].tsx        end-of-plan results
  settings/               settings, "How scoring works"
  dev/ui.tsx              component gallery (dev builds only)
src/domain/               pure time + scoring logic (fully tested)
src/data/                 Supabase client, queries, mutations, realtime, errors
src/components/           design-system components (no UI kit)
src/features/             screen-specific building blocks
src/lib/                  format, haptics, notifications, server clock, export
src/theme/                tokens, ThemeProvider
src/copy/en.ts            every user-facing string
supabase/migrations/      schema, RLS, RPCs, pg_cron job
supabase/tests/           pgTAP tests (01 is generated from shared vectors)
supabase/functions/       delete-account Edge Function
supabase/seed.sql         demo user with a completed and an active plan
scripts/                  SQL vector generator, Docker-free SQL smoke test
```

## Everyday commands

| Command                    | What it does                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `npm start`                | Metro for the development build (`--dev-client`)                                          |
| `npm run typecheck`        | `tsc --noEmit`                                                                            |
| `npm run lint`             | ESLint (expo config + Prettier)                                                           |
| `npm test`                 | Jest: domain, status line, summary, helpers                                               |
| `npm run check`            | All three of the above                                                                    |
| `npm run db:smoke`         | Runs migrations + all SQL tests on PGlite (no Docker needed)                              |
| `npm run db:smoke -- seed` | Runs migrations + seed and prints a day-status summary                                    |
| `npm run db:test`          | The real pgTAP suite: `supabase test db` (needs the local stack)                          |
| `npm run db:types`         | Regenerates `src/data/database.types.ts` from the local DB                                |
| `npm run gen:sql-vectors`  | Regenerates `supabase/tests/01_vectors.test.sql` from `src/domain/__tests__/vectors.json` |

## Setup, step by step

You need Node 20+ (22 tested), a Supabase account, an Expo account, a Google
Cloud project, and (for iOS) an Apple Developer account. For local Supabase you
also need Docker Desktop.

### 1. Install

```bash
npm install
```

```bash
cp .env.example .env
```

Expo CLI loads `.env` automatically. Only `EXPO_PUBLIC_*` values reach the app
bundle. **Never** put the service-role key in `.env`.

### 2. Supabase project (hosted)

1. Create a project at supabase.com. For Indian users pick **South Asia (Mumbai)**.
2. Copy **Project URL** and the **anon / publishable key** (Project Settings → API)
   into `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Link the CLI and push the schema. The CLI runs through `npx`, so no global install is needed.

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

```bash
npx supabase db push
```

4. **pg_cron:** the migration schedules `finalize_expired_plans()` hourly when
   pg_cron is available. In the dashboard, open Database → Extensions and make
   sure `pg_cron` is enabled. Then confirm in the SQL editor that
   `select jobname, schedule from cron.job;` lists `finalize-expired-plans`. If it
   doesn't, run:
   `select cron.schedule('finalize-expired-plans', '7 * * * *', 'select public.finalize_expired_plans()');`
   The app derives the effective status itself, so the UI stays correct even if this job never runs.
5. **Realtime:** the migration adds `plans` and `checkins` to the
   `supabase_realtime` publication. Check this under Database → Publications.
6. **Edge Function:**

```bash
npx supabase functions deploy delete-account
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.
JWT verification stays on (`verify_jwt = true`).

### 3. Email sign-in (6-digit code)

1. Authentication → Providers → **Email**: enabled. "Confirm email" can stay on;
   OTP verification confirms the address.
2. Authentication → **Email Templates**. In **Magic Link** and **Confirm signup**,
   replace the body with `supabase/templates/otp.html`. It must contain `{{ .Token }}`,
   because the app uses codes, not links.
3. Authentication → Settings: set **Email OTP length = 6** and **OTP expiry = 900 s**.
4. **Custom SMTP** (Authentication → Emails → SMTP): required before launch. The
   built-in sender is heavily rate-limited. Resend, Postmark or Amazon SES all work.

### 4. Google Sign-In (native, free)

In Google Cloud Console → APIs & Services:

1. **OAuth consent screen:** External, app name "Compound", support email,
   scopes `email`, `profile`, `openid`. Publish it when you're ready for real users.
2. **Credentials → Create OAuth client ID**, three times:
   - **Web application.** Its client ID is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Keep its
     **client secret** for Supabase. No redirect URIs are needed for the native flow.
   - **iOS**, bundle ID `app.compound.consistency`. Its client ID is
     `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and its _reversed_ client ID
     (`com.googleusercontent.apps.…`) is `GOOGLE_IOS_URL_SCHEME`.
   - **Android**, package `app.compound.consistency`, with the **SHA-1** of your signing
     key. Get it with `npx eas-cli credentials` (Android → development/production keystore).
     Create one Android client per keystore you use: the dev build and the Play upload key.
     If you ship through Play, add Play App Signing's SHA-1 as well.
3. Supabase → Authentication → Providers → **Google**: enable it.
   - **Client IDs:** web client ID, then a comma, then the iOS client ID.
   - **Client secret:** the web client secret.
   - **Skip nonce check:** ON (iOS native tokens carry a nonce the app can't forward).

### 5. Sign in with Apple (iOS)

1. Apple Developer → Identifiers: the App ID `app.compound.consistency` needs the
   **Sign In with Apple** capability. EAS adds it automatically because
   `ios.usesAppleSignIn` is set, as long as you let EAS manage credentials.
2. Supabase → Authentication → Providers → **Apple**: enable it, and set
   **Client IDs** to `app.compound.consistency`. The native-only flow needs no secret key.
3. Apple shares the user's name only on the first sign-in. The app saves it to the
   user's metadata at that moment.

### 6. EAS development build

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

Put the printed project ID in `.env` as `EAS_PROJECT_ID`, and your account in
`EAS_OWNER`. For cloud builds, also add every `EXPO_PUBLIC_*` value and
`GOOGLE_IOS_URL_SCHEME` as EAS environment variables (`npx eas-cli env:create`,
environment "development"), since `.env` is not uploaded.

Android (an installable APK):

```bash
npx eas-cli@latest build --profile development --platform android
```

iOS (register your iPhone first):

```bash
npx eas-cli@latest device:create
```

```bash
npx eas-cli@latest build --profile development --platform ios
```

Install the build on the phone, then run `npm start` and open the project from the
dev client. Expo Go will **not** work, because native Google Sign-In needs a dev build.

### 7. Sentry (optional)

Set `EXPO_PUBLIC_SENTRY_DSN`. Without it, Sentry is a no-op. For readable stack
traces in release builds, also set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and
`SENTRY_PROJECT` as EAS secrets.

### 8. Legal pages

Set `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL`. Both app stores require
a privacy policy, and an in-app account deletion flow (already built).

## Local Supabase (optional, needs Docker)

```bash
npx supabase start
```

```bash
npx supabase db reset
```

`db reset` applies the migrations and `supabase/seed.sql`, which creates
`demo@compound.app` with a completed 30-day plan and an active 60-day plan on day 40.
Sign in with the email code. Locally, the code shows up in Mailpit at
http://127.0.0.1:54324. To use the local stack from a phone, set
`EXPO_PUBLIC_SUPABASE_URL` to your computer's LAN IP (for example
`http://192.168.1.20:54321`), not `127.0.0.1`.

Run the real pgTAP suite:

```bash
npx supabase test db
```

To check the SQL without Docker, run `npm run db:smoke`. It runs the same
migration and test files on PGlite through a small pgTAP shim.

## How time works (short version)

- `close(D) = D 12:00 local + ((sleep − 12:00) mod 24h)`, `open(D) = close(D) − 2h`.
  Sleep at 01:00 closes day D at 01:00 on D+1.
- The SQL (`public.plan_window`) and the TypeScript (`src/domain/time.ts`) implement
  this identically, including DST gaps and overlaps. Both are checked against
  the shared vectors in `src/domain/__tests__/vectors.json`.
- The client measures its offset from Postgres `now()` (`server_time()` RPC) and uses
  server time for every countdown and state. The server enforces the window on
  every tick.

## Design QA

In a dev build, Settings → "Component gallery (dev)" opens `/dev/ui`. It shows
every component and state in both themes, with charts built from real domain output.
