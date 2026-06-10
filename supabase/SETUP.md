# Cloud sync setup (Supabase)

Cloud sync is **optional** — the app works fully offline without it. When the two
env vars below are present at build time, an account/cloud button appears and
users can sign in to back up and sync their leaks, streak, and lesson progress
across devices.

## 1. Create the project
1. Sign up at [supabase.com](https://supabase.com) and create a new project (free tier is plenty).
2. **SQL Editor → New query** → paste the contents of [`schema.sql`](./schema.sql) → **Run**.
   This creates the `user_state` table with row-level security.

## 2. Get the keys
**Project Settings → API**, copy:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

(The anon key is public by design — RLS keeps each user's data private.)

## 3. Local dev
Create `.env.local` in the repo root (already git-ignored):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Restart `npm run dev`. A cloud icon appears in the header.

## 4. Deployed app (GitHub Pages)
Add the same two values as repository **Actions → Variables** (or Secrets), then
pass them to the build step in `.github/workflows/*.yml`:

```yaml
- run: npm run build
  env:
    VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
```

Without these the build still succeeds — the cloud feature is simply hidden.

## 5. Auth options
- **Email + password** works out of the box. For frictionless testing, you can turn
  off email confirmation: **Authentication → Providers → Email → "Confirm email" off**
  (turn it back on for production).
- **Google sign-in** (the "Continue with Google" button): enable **Authentication →
  Providers → Google**, create an OAuth client in Google Cloud, and add your site URL
  (e.g. `https://daniel-willoughby.github.io/GTO-leak-fixer/`) plus the Supabase
  callback URL to the allowed redirect URIs. Until configured, that button errors
  gracefully; email/password still works.

## How sync works
- Local (IndexedDB + localStorage) stays the source of truth — the app never blocks on the network.
- On sign-in, the device's snapshot is **merged** with the cloud copy (decisions are
  unioned, streak/lesson progress take the best of each), written back to the device,
  and pushed up. Subsequent changes push in the background (debounced).
- One JSON row per user (`user_state`), last-write-wins on settings, union/merge on progress.
