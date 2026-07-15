# Coach Platform

A web app connecting fitness **coaches** with their **players**. Coaches build
weekly training programs (workouts + diet), track adherence, message players,
and run daily check-ups. Players view their program, log performance (sets/reps
+ video), and track progress. Player access is gated by an admin-issued
**subscription key** with an expiry date.

## Stack

- **Frontend:** Vite + React + TypeScript SPA (React Router, TanStack Query)
- **Backend:** Supabase — Postgres, Auth (email/password), Storage
- **Security:** Postgres Row-Level Security (RLS). The browser talks directly to
  Supabase; a future React Native app reuses the same backend and the
  `src/api/` data layer.

## Setup

1. **Install deps**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com). Then in
   the SQL Editor, run each file in `supabase/migrations/` in order
   (`0001` → `0008`), or the combined `supabase/_all_migrations_combined.sql`
   followed by `0008_signup_claim_keys.sql`.
   - In **Authentication → Providers → Email**, turn **Confirm email OFF**
     (accounts are created via signup and should log in immediately).
   - In `0008`, set your secret **coach invite code** (replaces
     `COACH-INVITE-2026`).

3. **Configure env.** Copy `.env.example` to `.env.local` and fill in from
   **Settings → API**:
   ```
   VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or the anon key
   ```

4. **Run**
   ```bash
   npm run dev
   ```

## Roles & signup

- **Coach** — signs up at `/signup/coach` with the **coach invite code**.
- **Player** — signs up at `/signup/player` with a **subscription key** the
  admin issued for them (the key links them to their coach).
- **Admin** — issues/renews/revokes subscription keys at `/admin/coaches`.

## Making the first admin

Sign up (as a player) or create a user, then in the SQL Editor:
```sql
update public.profiles set role='admin' where email='you@example.com';
```

## How privileged actions work (no service key in the browser)

All privileged operations run as `SECURITY DEFINER` Postgres functions that
self-authorize the caller — no service-role key is ever exposed to the browser:
- `signup_as_coach(code)` — promotes the caller to coach if the invite code matches.
- `claim_subscription_key(key)` — links a signed-up player to a pre-issued key.
- `admin_create_key` / `admin_update_key` — admin-only key management.

## Project layout

```
supabase/migrations/   SQL = source of truth for schema + RLS + RPCs
src/lib/supabase.ts    typed client singleton
src/api/               reusable, React-free data-access layer (mobile can reuse)
src/auth/              AuthContext, route guards
src/routes/            landing, auth, coach, player, admin pages
```
