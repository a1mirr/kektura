# 0046: Account menu

Status: Open
Specs: [0014](../specs/0014-pages-and-settings.md) Goal, AC-1, AC-7, AC-14, AC-15, AC-18 (the header link becomes the menu and the page is named "Settings" again), [0015](../specs/0015-about-page.md) (the page's name), [0024](../specs/0024-friends-sharing.md) AC-15 (the Friends link is the menu entry); built together with the header strip of task 0029

## Goal

Replace the header's "Friends" and "Account" links with one account dropdown, for desktop and mobile. (The wider page
layout this task used to carry moved to task [0070](0070-desktop-layout.md) on 2026-10-04, which comes first.)

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] The header strip of task 0029 exists: built here, or by task 0029 first (this task cannot be done without it)
- [ ] The tests that pin the old header and name are changed with the menu and the rename: `tests/messages.test.ts`, `e2e/account.spec.ts` (lines about the header links and "Settings"), `e2e/footer.spec.ts`, `e2e/auth.spec.ts`, `e2e/friends.spec.ts` (the Friends link) and `e2e/about.spec.ts` (the "Account" link in "Your data")
- [ ] The menu is built into the header strip of task 0070, and the tests under "Tests to write" exist
- [ ] `npm run e2e` run for the user flow; checked at 375, 768, 1024 and 1440 px
- [ ] The changelog entry in all three languages (spec 0018 AC-7)
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here.

### The account menu

- [ ] **R-1**: Every page a signed-in user sees shows one account button in the top-right corner of the header strip that
  sits above the page content (a strip shared with the logo of task 0029; the locale layout renders it, so a page does
  not draw its own). The button is labelled "Account" (`ru`: Аккаунт, `hu`: Fiók). It is the only account entry of the
  header: there are no separate "Friends" and "Account" links. The 404 page, which has no session, shows no menu.
- [ ] **R-2**: Activating the button opens a dropdown with three entries, in this order: **My stats**, **Friends** (only
  while the `friends` flag is on, task 0023) and **Settings**. Each entry is a link to its page in the current language.
  `ru`: Моя статистика, Друзья, Настройки. `hu`: Statisztikáim, Barátok, Beállítások. "Sign out" is not an entry: it stays
  on the page that Settings leads to (spec 0014 AC-16).
- [ ] **R-3**: **My stats** leads to `/stats` (task 0047). **Settings** leads to `/account`, which keeps sign out and
  account deletion (spec 0014). The menu entry, the page's document title and `h1`, and the About page's text name that
  page with one word (spec 0014 AC-18).
- [ ] **R-4**: The menu is a disclosure, not an application menu: a `<details>` with a `<summary>` that has an accessible
  name (which exposes its open state natively; with JavaScript the summary also carries `aria-expanded`), and the open list
  is a plain list of links (no `role="menu"`). It opens and closes with a click or tap and with Enter and
  Space; with JavaScript, Escape closes it and returns focus to the button, a click or tap outside closes it, and
  following a link closes it. Tab moves through the entries in order.
- [ ] **R-5**: The entry of the current page is marked (`aria-current="page"` and visibly).
- [ ] **R-6**: Without JavaScript, or before hydration, the entries are still reachable: the menu is a
  `<details>`/`<summary>` whose open state does not need script; the behaviour of R-4 beyond opening is an enhancement.
- [ ] **R-7**: Desktop: the list is anchored under the button, at least 200 px wide, never wider than the viewport.
  Mobile (375 px): the list stays inside the viewport (right-aligned to the button, no horizontal scroll),
  and the button and every entry have a touch target of at least 44 x 44 px.
- [ ] **R-8**: A signed-out visitor gets no account menu; the language switcher and the sign-in button are unchanged.
- [ ] **R-9**: The button and the three entries are translated in `ru`, `en` and `hu` (`tests/messages.test.ts`).

### Page width

Moved to task [0070](0070-desktop-layout.md) on 2026-10-04: R-10 to R-17 of this task (the layout component, the one width, side
padding, reading width, the dashboard from 1024 px, the footer, the map, full-height pages) are requirements of that task now,
with the owner's answers (64 rem, a centred reading column, two columns on the dashboard). This task puts the menu into the
header strip that task builds.

## Out of scope

Notifications or badges on the account button (a count of friend requests); an avatar picture; moving the language
switcher into the menu; a new visual design; a sidebar; a "sign out" entry in the menu (see Open questions).

## Open questions

- **Sign out in the menu.** One-click sign-out is common in such menus, and a plain form POST can live in a menu
  without script. This task keeps it on the settings page; should it be in the menu too?
- **One header strip.** task 0029 puts a logo top-left and this puts the menu top-right: do they share one header strip
  on every page (and the language switcher with them, see task 0029's open question)?
- **A page for "My stats".** This task assumes a page (task 0047), because the chart needs room and the dashboard is
  long. The alternative is a section of the dashboard.
- **The name of the settings page.** Task 0025 renamed "Settings" to "Account" because the page holds no real settings.
  The owner asked for "settings" in the menu, so this task renames the page back to "Settings" (one word everywhere,
  R-3). That changes tests that pin the old name: `tests/messages.test.ts` (no message key named `settings`, spec 0014
  AC-18), `e2e/account.spec.ts` (no "Settings" link) and `e2e/footer.spec.ts`. Confirm the rename, or label the entry
  "Account" instead.
- **Static pages.** Changelog, links and feedback are statically generated today (About already renders per request, because it
  reads the `friends` flag; the landing page reads the session and the search parameters). The feedback page would turn
  per-request anyway if the report link of task 0050 R-34 passes a stamp code. The menu needs
  the session and the runtime `friends` flag (`connection()`, the gotcha in `CLAUDE.md`), so a menu in the layout makes
  every page render per request. Proposal: accept that (the pages are small); the alternative is a client island that
  fetches the session and the flag from a small endpoint after load, which keeps those pages static but adds an endpoint.
- **The settings address.** The page is renamed "Settings" but stays at `/account`, with `/settings` redirecting to it today (spec
  0014 AC-15). Keep both as they are, or move the page to `/settings` and redirect `/account`?
- **The label.** The button says "Account" rather than the user's display name, because the display name is editable only
  on the Friends page, which is behind a flag.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-2, R-3, R-5, R-8 | planned: `e2e/account-menu.spec.ts` (signed in: entries, order, flag off hides Friends; signed out: no menu) |
| R-4 | planned: `src/components/AccountMenu.test.tsx` (open and close, Escape, outside click, focus return, ARIA) |
| R-6 | planned: `e2e/account-menu.spec.ts` (JavaScript disabled: the entries open and navigate) |
| R-7 | planned: `e2e/account-menu.spec.ts` (375 px: list inside the viewport, target sizes) |
| R-9 | `tests/messages.test.ts` |

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: account menu as a dropdown (my stats, friends, settings), all pages into one wide
layout, desktop and mobile versions of both. The stats page it links to is task 0047.

- There is no shared header today: the dashboard, account and friend pages draw their own `<header>`, the about,
  changelog, links and feedback pages have none, and the language switcher exists only on the landing page and the
  dashboard. The menu therefore needs the shared strip of task 0029 (or one built here) in the locale layout.
- Today the dashboard, account, about, changelog, feedback, links and friend pages use `mx-auto max-w-3xl px-6 py-8`,
  the friends list `max-w-xl p-4`, the invite `max-w-md`, and `Footer` `max-w-3xl`. The friends link is
  `friendsEnabled()` in the dashboard header: the layout reads the session with `getUser()` only (the gotcha in `CLAUDE.md`), and the menu renders its entries on the server so the flag is read at
  request time (the runtime-flag gotcha in `CLAUDE.md`); a client component is needed only for focus handling (see the open
  question on static pages).
- Tailwind 4: define the width as a CSS variable (`--page-width`).

Code the work touches: `src/components/AccountMenu.tsx`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/dashboard/page.tsx`, every page's `<main>`, `src/components/Footer.tsx`, `messages/*.json` (`accountMenu.*`)
