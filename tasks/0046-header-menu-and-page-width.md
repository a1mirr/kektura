# 0046: Account menu and one wide page layout

Status: Open
Specs: [0040](../specs/0040-header-menu-and-page-width.md) AC-1 to AC-17 (added), [0014](../specs/0014-pages-and-settings.md) Goal and AC-7, AC-14,
AC-15, AC-18 (changed: the header link becomes the menu and the page is named "Settings" again), [0015](../specs/0015-about-page.md)
(the page's name), [0024](../specs/0024-friends-sharing.md) AC-15 (the Friends link is the menu entry), [0029](../specs/0029-site-logo-link.md)
AC-7 (the shared header strip)

## Goal

Replace the header's "Friends" and "Account" links with one account dropdown, and give every page the same, wider content
column through one layout component, for desktop and mobile.

## Done when

- [ ] The header strip of spec 0029 exists: built here, or by that spec's own task first (spec 0040 cannot be done without it)
- [ ] The tests that pin the old name are changed with the rename (`tests/messages.test.ts`, `e2e/account.spec.ts`, `e2e/footer.spec.ts`)
- [ ] The open questions of spec 0040 are settled with the owner (sign out in the menu, one header strip with the logo, the
      width) and the spec is `Accepted`
- [ ] The menu and `PageShell` are built, every page uses the shell, and the tests of the spec's coverage table exist
- [ ] `npm run e2e` run for the user flow; checked at 320, 375, 768, 1024 and 1440 px
- [ ] The changelog entry in all three languages (spec 0018 AC-7)
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: account menu as a dropdown (my stats, friends, settings), all pages into one wide
layout, desktop and mobile versions of both. The stats page it links to is task 0047.
