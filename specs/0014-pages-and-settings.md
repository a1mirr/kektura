# 0014: Footer pages and account settings

Status: Done
Owner code: `src/components/Footer.tsx`, `src/app/[locale]/(pages)/*`, `src/app/[locale]/settings/*`,
`supabase/migrations/0008_pages_settings.sql`

## Goal

Footer navigation to the informational pages (About, Changelog, Useful links, Feedback), and an account
settings page for signed-in users whose one option, for now, is deleting the account.

## Behaviour

### Footer navigation

- **AC-1**: Every page has a footer with links to About, Changelog, Useful links and Feedback, in the
  page's language. The footer links only to pages anyone can open; the settings page is reached from
  the dashboard header (AC-7), because a footer link would lead signed-out visitors nowhere.

### Informational pages

- **AC-2**: `/about` tells what the app is, how progress is counted, where the data comes from and what
  happens to the user's data (spec 0015).
- **AC-3**: `/changelog` lists what changed and when, newest first (spec 0018).
- **AC-4**: `/links` lists useful links for the trail, grouped (spec 0019).

### Feedback form

- **AC-5**: `/feedback` has a form to send a message to the developer (spec 0017).
- **AC-6**: A submitted message is stored in `user_feedback` and delivered to the developer (spec 0017).

### Settings page

- **AC-7**: `/settings` is for signed-in users; a signed-out visitor is sent to the landing page. The
  dashboard header has a "Settings" link next to "Sign out".
- **AC-8**: The "Stamps per month" chart (spec 0001 AC-5) is shown on `/settings`, not on the dashboard.
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
- After the deletion the user's session no longer exists at the Auth server, so `signOut()` gets a
  401/403 back; supabase-js ignores that and still clears the session cookies.
- **Open question for the owner**: AC-8 (the per-month chart on the settings page instead of the
  dashboard) came with the first version of this page. It is kept as is; if the chart should be back on
  the dashboard, change AC-8 and move one component.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/footer.spec.ts` (four links on a public page and on the dashboard, in ru/en/hu, none for settings) |
| AC-2 | spec 0015 |
| AC-3, AC-4 | specs 0018, 0019 |
| AC-5, AC-6 | spec 0017 |
| AC-7 | `e2e/settings.spec.ts` (redirect when signed out, header link) |
| AC-8 | manual: `/settings` shows the chart (no test yet) |
| AC-9, AC-10 | `e2e/settings.spec.ts` (cancel; delete: account, stamps and extra stamps gone, feedback kept and unlinked, signed out, signing in again gives an empty account), `src/app/[locale]/settings/DeleteAccountButton.test.tsx` |
| AC-11 | `DeleteAccountButton.test.tsx`, `e2e/settings.spec.ts` (server action answering 500) |
| AC-12 | `e2e/feedback.spec.ts` (anonymous caller refused); migration 0008 |
| AC-13 | `src/app/[locale]/settings/actions.test.ts`, `src/lib/log.test.ts` |
