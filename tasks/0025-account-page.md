# 0025: Account page: sign out moves in, "Settings" becomes "Account"

Status: Done
Specs: [0014](../specs/0014-pages-and-settings.md) AC-14 to AC-18; [0005](../specs/0005-auth-routing-i18n.md) AC-6 and [0018](../specs/0018-changelog.md) AC-7 (this task was written as spec 0025; its behaviour now lives in 0014)

## Goal

The dashboard header carried two plain links next to the language switcher: "Settings" and "Sign out". "Settings"
held no real settings (a chart and account deletion), and signing out is an account action as well. One link,
"Account", leads to a page that holds all of it. The header gets lighter, which matters most on a phone, and
"Account" says what is behind the link.

## Done when

- [x] The header has the language switcher and one "Account" link, no "Settings" and no "Sign out" (was 0025 AC-1, now 0014 AC-14)
- [x] `/account` replaces `/settings`, with a title and `h1` "Account"; the old address redirects (was AC-2, now 0014 AC-15)
- [x] The account page has the "Sign out" button, a plain form POST (was AC-3, now 0014 AC-16)
- [x] Signing out works with JavaScript off (was AC-4, now 0014 AC-17)
- [x] The page, link and button are translated in all three languages; the About page uses the new name and links to `/account` (was AC-5, now 0014 AC-18)
- [x] The changelog entry of 2026-10-02 says so in all three languages (was AC-6; the rule is 0018 AC-7, and the tests of this entry now cite it)

## Spec changes

AC-1 to AC-5 moved into spec 0014 as AC-14 to AC-18 (its AC-7 no longer tells the story of the rename). AC-6 was a
changelog entry, not behaviour; its tests are now instances of 0018 AC-7. The notes of this task that still hold
(namespace names, the temporary redirect) are in 0014's notes.

## Notes

- Renamed with the page: the folder `src/app/[locale]/settings` became `account`, the message namespace `settings`
  became `account`, `dashboard.settings` became `dashboard.account` and `dashboard.signOut` moved to
  `account.signOut`. The `[account-delete]` log line and the `delete_user_account` function kept their names.
- `/settings` was about a day old when this was done and linked from the dashboard header and the public About page,
  which is why it redirects. The redirect is temporary (307) so the address stays free for real settings.
- The changelog entry of 2026-10-02 was the newest, so this change joined it; its two older items that said
  "Account settings" now say "Account page".
- Out of scope then: new things on the account page, changing how sign out works.
