# 0025: Account page: sign out moves in, "Settings" becomes "Account"

Status: Done
Owner code: `src/app/[locale]/account/*` (was `settings/*`), `src/components/SignOutButton.tsx`,
`src/app/[locale]/dashboard/page.tsx` (header), `src/app/[locale]/(pages)/about/page.tsx` (link),
`messages/*.json` (`account.*`, `dashboard.account`), `src/content/changelog.ts`

## Goal

The dashboard header carried two plain links next to the language switcher: "Settings" and "Sign out".
"Settings" holds no real settings (a chart and account deletion), and signing out is an account action as
well. One link, "Account", leads to a page that holds all of it. The header gets lighter, which matters most
on a phone, and "Account" says what is behind the link.

## Behaviour

- **AC-1**: The dashboard header has the language switcher and one link, "Account" (`ru`: Аккаунт,
  `hu`: Fiók), to `/account`. It has no "Settings" link and no "Sign out" control.
- **AC-2**: `/account` replaces `/settings`. It is for signed-in users: a signed-out visitor is sent to the
  landing page. Its document title and `h1` are "Account". Everything spec 0014 put on the settings page is
  still there (the per-month chart, account deletion). `/settings` no longer exists.
- **AC-3**: The account page has a "Sign out" button (`ru`: Выйти, `hu`: Kijelentkezés) next to its heading.
  It behaves as spec 0005 AC-6 says: a plain form POST to `/auth/sign-out` that revokes the session, clears
  the cookies and returns to the landing page in the current locale. Afterwards the dashboard and the account
  page send the visitor to the landing page.
- **AC-4**: Signing out from the account page works with JavaScript off (the button is a plain form, not a
  client component).
- **AC-5**: The page, the header link and the button are translated in all three languages, and the About
  page (spec 0015) calls the page by its new name in its "Your data" text and links to `/account`.
- **AC-6**: The changelog says so (spec 0018 AC-7): the newest entry mentions the Account page, that the
  stamps-per-month chart moved there, and that "Sign out" moved there and "Settings" is now "Account", in
  all three languages.

## Out of scope

- A redirect from `/settings`. The page is a day old and was never linked from outside the app; the old
  address answers 404 like any unknown page.
- New things on the account page (the signed-in email, language, data export): spec 0014 lists what is out
  of scope there.
- Changing how sign out works (spec 0005 AC-6, spec 0020 AC-3).

## Notes

- Renamed with the page: the folder `src/app/[locale]/settings` is now `account`, the message namespace
  `settings` is now `account` (its `title` is "Account"), `dashboard.settings` is now `dashboard.account` and
  `dashboard.signOut` moved to `account.signOut`. The `[account-delete]` log line and the `delete_user_account`
  function keep their names.
- Specs 0014 (AC-7 to AC-13), 0005 (AC-6), 0015 (AC-5) and 0018 (AC-6) are edited in place to use the new
  name and address. Spec 0014's file name stays so that existing links keep working.
- The changelog entry of 2026-10-02 is the newest, so this change joins it (spec 0018 AC-7); its two older
  items that said "Account settings" now say "Account page".

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2 | `e2e/account.spec.ts` (header link and no sign-out control; signed-out redirect; title and heading; `/settings` is a 404) |
| AC-3 | `e2e/account.spec.ts` (sign out from the account page, then dashboard and account redirect), `e2e/auth.spec.ts` |
| AC-4 | `e2e/account.spec.ts` (with JavaScript disabled) |
| AC-5 | `e2e/account.spec.ts` (`ru` and `hu`), `e2e/about.spec.ts` (link), `tests/messages.test.ts` (parity) |
| AC-6 | `src/content/changelog.test.ts` (the newest entry says it in all three languages) |
