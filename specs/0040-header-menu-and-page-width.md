# 0040: Header, account menu and page width

Status: Draft
Owner code: `src/components/AccountMenu.tsx`, `src/components/PageShell.tsx` (new), `src/app/[locale]/layout.tsx`,
`src/app/[locale]/dashboard/page.tsx`, every page's `<main>`, `src/components/Footer.tsx`, `messages/*.json`
(`accountMenu.*`)

Folds into [0014](0014-pages-and-settings.md) (AC-14, the header link to the account page) and, with
[0029](0029-site-logo-link.md), into one description of the page frame when it is built.

## Goal

The frame around every page: the header with the signed-in user's account entry, and the width of the content.
A signed-in user reaches their personal pages (stats, friends, settings) from one account menu instead of a growing
row of links, and every page uses the same, wider content column. Both work on desktop and on a phone.

## Behaviour

### The account menu

- **AC-1**: Every page a signed-in user sees shows one account button in the top-right corner of the page header,
  with the user's display name (spec 0024 AC-1) or, while there is none, the word "Account". It is the only account
  entry of the header: there are no separate "Friends" and "Account" links.
- **AC-2**: Activating the button opens a dropdown with three entries, in this order: **My stats**, **Friends** (only
  while the `friends` flag is on, spec 0023) and **Settings**. Each entry is a link to its page in the current language.
  `ru`: Моя статистика, Друзья, Настройки. `hu`: Statisztikáim, Barátok, Beállítások. "Sign out" is not an entry: it stays
  on the settings page (spec 0014 AC-16).
- **AC-3**: **My stats** leads to `/stats` (spec 0041). **Settings** leads to `/account`, which keeps sign out and
  account deletion (spec 0014).
- **AC-4**: The menu follows the usual menu behaviour. It opens and closes with a click or tap on the button, with
  Enter and Space; Escape closes it and returns focus to the button; a click or tap outside closes it; following a
  link closes it. Arrow keys move between entries. The button has `aria-haspopup`, `aria-expanded` and an accessible
  name; the open list is `role="menu"` with `role="menuitem"` entries.
- **AC-5**: The entry of the current page is marked (`aria-current="page"` and visibly).
- **AC-6**: Without JavaScript, or before hydration, the entries are still reachable: the menu is a
  `<details>`/`<summary>` or an equivalent that opens without script.
- **AC-7**: Desktop: the list is anchored under the button, at least 200 px wide, never wider than the viewport.
  Mobile (375 px and 320 px): the list stays inside the viewport (right-aligned to the button, no horizontal scroll),
  and the button and every entry have a touch target of at least 44 x 44 px.
- **AC-8**: A signed-out visitor gets no account menu; the language switcher and the sign-in button are unchanged.
- **AC-9**: The button and the three entries are translated in `ru`, `en` and `hu` (`tests/messages.test.ts`).

### Page width

- **AC-10**: One layout component, `PageShell`, sets the content width, side padding and vertical rhythm of a page.
  Every page uses it instead of its own `<main className="mx-auto max-w-...">`. The landing page, the error page and
  the 404 page are centred hero pages and keep their narrow column; the invite page keeps its card width. A new
  page gets the width without remembering it.
- **AC-11**: The width is a single value (a CSS variable, so the footer and the shell cannot disagree), proposed
  `max-w-6xl` (72 rem). At and above that viewport width content is centred at it; below it, content fills the
  viewport minus the side padding. The friends list and the friend's page are no longer narrower than the rest.
- **AC-12**: Side padding is 16 px up to 640 px and 24 px above. A page never scrolls horizontally at 320, 375, 768,
  1024 and 1440 px.
- **AC-13**: Pages that are a long read (about, changelog, links, feedback, the text blocks of the account page) keep
  a readable line length of about 65 characters (`max-w-prose`) inside the wide shell. Cards, the map, charts and
  stage lists use the full width.
- **AC-14**: From 1024 px the dashboard uses the room: the stat cards stay in a row, the map is wider (its height
  scales with it but never exceeds 70 % of the viewport height). On mobile everything stays one column. A stage
  section's own open/close behaviour (spec 0001 AC-8) does not change.
- **AC-15**: The footer's links line up with the content edge (same width), and the logo of spec 0029 and the account
  menu sit at the shell's left and right edge.
- **AC-16**: The map's fullscreen mode (spec 0003 AC-11) is unchanged, and the map fits its container at any width,
  including when the viewport is resized.
- **AC-17**: The rule for full-height pages stays: pages that use `flex-1` fill the screen and keep the footer on the
  first screen.

## Out of scope

Notifications or badges on the account button (a count of friend requests); an avatar picture; moving the language
switcher into the menu; a new visual design; a sidebar; a "sign out" entry in the menu (see Open questions).

## Open questions

- **Sign out in the menu.** One-click sign-out is common in such menus, and a plain form POST can live in a menu
  without script. This draft keeps it on the settings page; should it be in the menu too?
- **One header strip.** Spec 0029 puts a logo top-left and this puts the menu top-right: do they share one header strip
  on every page (and the language switcher with them, see 0029's open question)?
- **A page for "My stats".** This draft assumes a page (spec 0041), because the chart needs room and the dashboard is
  long. The alternative is a section of the dashboard.
- **A long display name** on the button: this draft truncates to one line with an ellipsis and shows the full name at
  the top of the dropdown.
- **How wide.** `max-w-6xl` (1152 px) is a guess; `max-w-5xl` is safer for text, `max-w-7xl` suits a big map. A look at
  the dashboard at 1440 px at each of these settles it.
- **Two columns for the stage list** on desktop: stage sections can be tall when open and may leave a gap on one side.
  A first cut can leave the list in one full-width column and widen only the map and cards.

## Notes

- Today the dashboard, account, about, changelog, feedback, links and friend pages use `mx-auto max-w-3xl px-6 py-8`,
  the friends list `max-w-xl p-4`, the invite `max-w-md`, and `Footer` `max-w-3xl`. The friends link is
  `friendsEnabled()` in the dashboard header: the menu renders its entries on the server so the flag is read at
  request time (the runtime-flag gotcha in `CLAUDE.md`); a client component is needed only for focus handling.
- Tailwind 4: define the width as a CSS variable (`--page-width`).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-5, AC-8 | planned: `e2e/account-menu.spec.ts` (signed in: entries, order, flag off hides Friends; signed out: no menu) |
| AC-4 | planned: `src/components/AccountMenu.test.tsx` (open and close, Escape, outside click, arrow keys, ARIA) |
| AC-6 | planned: `e2e/account-menu.spec.ts` (JavaScript disabled: the entries open and navigate) |
| AC-7 | planned: `e2e/account-menu.spec.ts` (375 and 320 px: list inside the viewport, target sizes) |
| AC-9 | `tests/messages.test.ts` |
| AC-10 | planned: `tests/page-shell.test.ts` (no page file has its own `max-w-` main; each imports `PageShell`) |
| AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17 | planned: `e2e/layout.spec.ts` (content width and no overflow at 320, 375, 768, 1024 and 1440 px on each page; fullscreen map; footer on the first screen) |
