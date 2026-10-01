# Kektura tracker

## Setup
1. Create a project at https://supabase.com.
2. In the SQL editor run every file in `supabase/migrations/` in numeric order (`0001_init.sql` … `0006_rls_initplan.sql`), then `supabase/seed.sql` and `supabase/seed_extra.sql` (re-run the seeds whenever they are regenerated).
3. Google login:
   - Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web).
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → Providers → Google: paste the client ID and secret.
   - Supabase → Authentication → URL Configuration: add `http://localhost:3000/**` to Redirect URLs (and your production URL with `/**` later). The wildcard matters: the app redirects to `/auth/callback?locale=<locale>`, query string included.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Supabase → Project Settings → API).
5. `npm run dev` and open http://localhost:3000.

## Development
Spec first: every task gets a spec with numbered acceptance criteria in `specs/` (see
[`specs/README.md`](specs/README.md)), and tests cite those criteria.

- `npm test`: unit and regression tests (Vitest); `npm run test:watch` while working.
- `npm run check`: typecheck + lint + tests. Claude Code runs the same gate automatically before
  finishing a turn (`.claude/settings.json`).
