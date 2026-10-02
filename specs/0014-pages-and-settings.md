# 0014: Footer pages and the account page

Status: Done
Owner code: `src/components/Footer.tsx`, `src/app/[locale]/(pages)/*`, `src/app/[locale]/account/*`,
`supabase/migrations/0008_pages_settings.sql`

## Goal

Footer navigation to the informational pages (About, Changelog, Useful links, Feedback), and an account
page for signed-in users (called "settings" until spec 0025) whose one option, for now, is deleting the
account.

## Behaviour

### Footer navigation

- **AC-1**: Every page has a footer with links to About, Changelog, Useful links and Feedback, in the
  page's language. The footer links only to pages anyone can open; the account page is reached from
  the dashboard header (AC-7), because a footer link would lead signed-out visitors nowhere. Full-height
  pages (landing, error) fill the space above the footer instead of a whole screen, so on a phone the
  landing page and its footer fit one screen without scrolling.

### Informational pages

- **AC-2**: `/about` tells what the app is, how progress is counted, where the data comes from and what
  happens to the user's data (spec 0015).
- **AC-3**: `/changelog` lists what changed and when, newest first (spec 0018).
- **AC-4**: `/links` lists useful links for the trail, grouped (spec 0019).

### Feedback form

- **AC-5**: `/feedback` has a form to send a message to the developer (spec 0017).
- **AC-6**: A submitted message is stored in `user_feedback` and delivered to the developer (spec 0017).

### Account page

- **AC-7**: `/account` is for signed-in users; a signed-out visitor is sent to the landing page. The
  dashboard header has an "Account" link (spec 0025 AC-1; before it was "Settings" next to "Sign out").
- **AC-8**: The "Stamps per month" chart (spec 0001 AC-5) is shown on `/account`, not on the dashboard.
- **AC-9**: "Delete account" asks for confirmation first ("Are you sure? This cannot be undone." with a
  confirm button and a cancel link). Confirming permanently deletes the account with all its stamps and
  extra stamps, signs the user out and returns to the landing page. Cancelling changes nothing.
- **AC-10**: Feedback the user sent before stays, but is no longer linked to them
  (`user_feedback.user_id` becomes null).
- **AC-11**: When deleting fails (the server refuses or isn't reachable) the page says so in the user's
  language, next to the button, which can be used again; nothing is deleted. When the session has
  expired the page refreshes, which sends the user to the landing page. No browser `alert()`.
- **AC-12**: A user can only delete their own account: `delete_user_account()` works on `auth.uid()`
  and can't be executed by anonymous callers.
- **AC-13**: The delete action never throws: it returns an `ActionResult` (`ok`, `unauthorized` or
  `failed`) and logs a failure as one `[account-delete]` line without secrets (spec 0008's rules).

## Out of scope

Other settings (language, email, export of the data); a "type your email to confirm" step.

## Notes

- Deleting needs a database function with elevated rights (`security definer`), because a user can't
  delete their own row in `auth.users` through the API. The stamps follow through `on delete cascade`.
- Supabase's advisor flags `delete_user_account()` as a WARN ("signed-in users can execute a SECURITY
  DEFINER function"). That is intended: a signed-in user must be able to call it, and it only ever deletes
  `auth.uid()`'s own row; anonymous callers can't run it (tested). The alternative, deleting through the
  Auth admin API, would put the `service_role` key (full access to everything) into the app server's
  environment, which is the bigger risk.
- After the deletion the user's session no longer exists at the Auth server, so `signOut()` gets a
  401/403 back; supabase-js ignores that and still clears the session cookies.
- **Decided by the owner (2026-10-02)**: the per-month chart stays on the account page (AC-8), not on the
  dashboard. To move it, change AC-8, the E2E test below and one component.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/footer.spec.ts` (four links on a public page and on the dashboard, in ru/en/hu, none for the account page; landing page and footer fit one phone screen) |
| AC-2 | spec 0015 |
| AC-3, AC-4 | specs 0018, 0019 |
| AC-5, AC-6 | spec 0017 |
| AC-7 | `e2e/account.spec.ts` (redirect when signed out, header link), spec 0025 |
| AC-8 | `e2e/account.spec.ts` (`/account` shows the chart heading, the dashboard doesn't) |
| AC-9, AC-10 | `e2e/account.spec.ts` (cancel; delete: account, stamps and extra stamps gone, feedback kept and unlinked, signed out, signing in again gives an empty account), `src/app/[locale]/account/DeleteAccountButton.test.tsx` |
| AC-11 | `DeleteAccountButton.test.tsx`, `e2e/account.spec.ts` (server action answering 500) |
| AC-12 | `e2e/feedback.spec.ts` (anonymous caller refused); migration 0008 |
| AC-13 | `src/app/[locale]/account/actions.test.ts`, `src/lib/log.test.ts` |
