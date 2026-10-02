# 0005: Sign-in, routing, translations

Status: Done
Owner code: `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/app/[locale]/page.tsx`,
`src/app/[locale]/dashboard/page.tsx`, `src/i18n/*`, `messages/*.json`

## Goal

Google sign-in through Supabase, locale-prefixed routes (`ru` default, `en`, `hu`) and a UI that is
complete in all three languages.

## Behaviour

- **AC-1**: The proxy (session refresh + locale routing) runs on every page and skips the OAuth
  callback, Next internals and files with an extension (`/data/*.json`, the MapLibre worker, ...).
  The matcher's extension escape must stay `\\.` in the TS string.
- **AC-2**: A signed-in visitor of the landing page goes straight to their dashboard. The landing
  page and the dashboard use the same session check (`getUser`), so a revoked but unexpired token
  can never bounce between them.
- **AC-3**: A signed-out visitor of the dashboard is redirected to the landing page.
- **AC-4**: The OAuth callback only ever redirects to a known locale (`?locale=` is validated) and
  shows the sign-in error on failure.
- **AC-5**: All three message files have exactly the same keys, the same ICU placeholders per key,
  and no empty strings.
- **AC-6**: "Sign out" (a button on the account page, spec 0025) is a plain form POST to `/auth/sign-out`: it works before the page has
  hydrated, revokes the session at Supabase from the server, clears the session cookies and returns
  to the landing page in the current locale.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `src/proxy.test.ts` |
| AC-2, AC-3, AC-6 | `e2e/auth.spec.ts` (test server, spec 0006) |
| AC-4 | manual: `/auth/callback?locale=xx` -> `/ru?error=auth` (needs a real OAuth round trip for the success path) |
| AC-5 | `tests/messages.test.ts` |
