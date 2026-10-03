# 0014: Footer pages and the account page

Status: Done
Owner code: `src/components/Footer.tsx`, `src/app/[locale]/(pages)/*`, `src/app/[locale]/account/*`,
`src/components/SignOutButton.tsx`, `src/app/[locale]/dashboard/page.tsx` (header), `next.config.ts` (the
`/settings` redirect), `supabase/migrations/0008_pages_settings.sql`, `messages/*.json` (`account.*`,
`dashboard.account`)

## Goal

Footer navigation to the informational pages (About, Changelog, Useful links, Feedback), and an account page for
signed-in users that holds everything about the account: the stamps-per-month chart, signing out and deleting the
account. The dashboard header stays light (the language switcher and one "Account" link), which matters most on a
phone, and "Account" says what is behind the link.

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
  dashboard header has an "Account" link to it (AC-14).
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
- **AC-14**: The dashboard header has the language switcher and one link, "Account" (`ru`: Аккаунт, `hu`: Fiók), to
  `/account`. It has no "Settings" link and no "Sign out" control.
- **AC-15**: The page's document title and `h1` are "Account". The old address `/settings`, in any language prefix,
  redirects (307, in `next.config.ts`, so before the proxy and without a session) to `/account` in the same
  language, so open tabs and old links don't end on a 404.
- **AC-16**: The account page has a "Sign out" button (`ru`: Выйти, `hu`: Kijelentkezés) next to its heading. It
  behaves as spec 0005 AC-6 says: a plain form POST to `/auth/sign-out` that revokes the session, clears the
  cookies and returns to the landing page in the current locale. Afterwards the dashboard and the account page send
  the visitor to the landing page.
- **AC-17**: Signing out from the account page works with JavaScript off (the button is a plain form, not a client
  component).
- **AC-18**: The page, the header link and the button are translated in all three languages, and the About page
  (spec 0015) calls the page by its name in its "Your data" text and links to `/account`.

## Out of scope

Other settings (language, email, export of the data); a "type your email to confirm" step; showing the signed-in
email on the page.

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
- The per-month chart lives on the account page by the owner's decision (AC-8). To move it, change AC-8, the E2E
  test below and one component.
- The message namespace is `account` (`title`, `signOut`, ...), the header link is `dashboard.account`. The
  `[account-delete]` log line and the `delete_user_account` function keep their names from when the page was
  called "settings"; this file's name does too, so existing links keep working.
- The `/settings` redirect is temporary so the address stays free for real settings, and can be deleted once
  nobody has the old address.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/footer.spec.ts` (four links on a public page and on the dashboard, in ru/en/hu, none for the account page; landing page and footer fit one phone screen) |
| AC-2 | spec 0015 |
| AC-3, AC-4 | specs 0018, 0019 |
| AC-5, AC-6 | spec 0017 |
| AC-7, AC-14, AC-15 | `e2e/account.spec.ts` (redirect when signed out; header link and no sign-out control; title and heading; `/settings` redirects to `/account` in each language) |
| AC-8 | `e2e/account.spec.ts` (`/account` shows the chart heading, the dashboard doesn't) |
| AC-9, AC-10 | `e2e/account.spec.ts` (cancel; delete: account, stamps and extra stamps gone, feedback kept and unlinked, signed out, signing in again gives an empty account), `src/app/[locale]/account/DeleteAccountButton.test.tsx` |
| AC-11 | `DeleteAccountButton.test.tsx`, `e2e/account.spec.ts` (server action answering 500) |
| AC-12 | `e2e/feedback.spec.ts` (anonymous caller refused); migration 0008 |
| AC-13 | `src/app/[locale]/account/actions.test.ts`, `src/lib/log.test.ts` |
| AC-16 | `e2e/account.spec.ts` (the button sits next to the heading; sign out from the account page in each language, then dashboard and account redirect), `e2e/auth.spec.ts` |
| AC-17 | `e2e/account.spec.ts` (with JavaScript disabled) |
| AC-18 | `tests/messages.test.ts` (the header link, the page title and the About page's link text use the same name in each language, and no key is still called settings), `e2e/account.spec.ts` (`ru` and `hu`), `e2e/about.spec.ts` (link) |
