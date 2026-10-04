# 0070: Use the room on a desktop screen

Status: Open
Specs: [0014](../specs/0014-pages-and-settings.md) AC-19 (the logo's place in the header, 320 px), [0001](../specs/0001-progress.md) (the dashboard's order and layout), [0003](../specs/0003-map-route-planner.md) (the map's size, AC-12 "Show in list" next to a sticky map, the sentence about what lies around the comparison map), [0024](../specs/0024-friends-sharing.md) (AC-22 "above the stage list", the Friends pages' layout, AC-20 and AC-22 320 px), [0005](../specs/0005-auth-routing-i18n.md) AC-10 (320 px); takes the page-width requirements of task [0046](0046-header-menu-and-page-width.md) (R-10 to R-17) over

## Goal

On a desktop the pages are a narrow column in the middle of a wide screen: the content is 48 rem wide, the logo sits
at the far left edge of the window, the footer is as narrow as the content, and the rest is empty. Make a desktop
screen look designed: header, content and footer share one width and edges, long reads keep a comfortable line, and the
pages that are made of independent blocks (the dashboard, the Friends pages) put them side by side. The phone layout,
at 375 px, does not change.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] Checked at 375, 768, 1024, 1440 and 1920 px, in every language, signed in and signed out
- [ ] The existing end-to-end specs stay green at Playwright's default desktop window (1280 x 720, which is inside the new two-column layout): `stamping`, `stamp-dates`, `extra-stamps-stages`, `map`, `friends`, `friends-compare` and the rest are adapted where a click target or a scroll position moved
- [ ] The changelog entry in every language (spec 0018 AC-7), if the change is what users see on any page
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it (2026-10-04: "for desktop we'll have huge gaps on
left and right, and page doesn't look good at all, especially this Kéktúra tracker button very far away"). They are
written into the owning specs as the behaviour is built; until then they live here.

### Width and edges

- [ ] **R-1**: The header strip (the logo, and the account menu of task 0046 once it exists), the page content and the
  footer share one content width and one pair of edges: 64 rem. The logo sits at that left edge, whatever the window width,
  so on a wide window it is never at the window's edge. A page's own header (the dashboard's and a friend's page's title
  row, with the language switcher and links) lies inside the same width.
- [ ] **R-2**: One layout component sets the content width, the side padding and the vertical rhythm of a page, so a
  new page gets them without remembering them (a test fails for a page file with a container of its own). The width
  is one value, 64 rem (`max-w-5xl`), in a CSS variable, so the header, the pages and the footer cannot disagree. Below that width content fills the window minus the side padding (16 px up to 640 px, 24
  px above); at and above it, content is centred at it.
- [ ] **R-3**: Pages that are a long read (About, Changelog, Useful links, Feedback, the text blocks of the account page)
  keep a line length of about 65 characters, in a column centred inside that width. Cards, the map, charts and stage lists use the full width.
- [ ] **R-4**: The landing page, the error page and the 404 page keep their centred hero layout, the invite page its
  card; none of them gets an empty wide column.

### Using the room

- [ ] **R-5**: From 1024 px the dashboard has two columns: the stat cards and the map on the left, sticky while the stage
  list scrolls on the right; the map's height is never more than 70 % of the window height. "Show in list" (spec 0003 AC-12)
  and the stage links still bring the row into view, below any sticky element. Below 1024 px everything is one column, in the order it has today.
- [ ] **R-6**: From 1024 px the friend's page puts the Compare section (cards, map) next to the stage list, and the
  Friends page puts the person's own controls (name, invite link, pending requests) next to the list of friends. Below
  1024 px they are one column as today.
- [ ] **R-7**: The map keeps fitting its container at any width, also when the window is resized, and its fullscreen
  mode (spec 0003 AC-11) does not change.

### Narrow screens

- [ ] **R-8**: At 375 px nothing changes for the reader: one column, no sideways scroll, targets of at least 44 px. 375 px
  is the narrowest width the layout promises: the 320 px wording is removed from the specs that state it and the tests
  stop checking it (the page may still work there, but nothing is promised or guarded).
- [ ] **R-9**: A page never scrolls sideways at 375, 768, 1024, 1440 and 1920 px.
- [ ] **R-10**: Full-height pages keep using `flex-1`, so the footer stays on the first screen (the rule in CLAUDE.md,
  Gotchas).

## Out of scope

A new visual design (colours, fonts, the look of cards); a sidebar or a new navigation; the account menu itself (task
0046); a dark theme; a layout for very wide screens that changes the content (more columns of the same list) rather than
centring it.

## Open questions

All settled with the owner on 2026-10-04:

- **Overlap with task 0046:** yes, the page-width requirements move here (0046's R-10 to R-17 now point to this task), so this task comes
  first and gives 0046 a layout to put the menu into.
- **The content width:** 64 rem (`max-w-5xl`), "no idea, let's do 64". It is one CSS variable, so changing it later is one line.
- **Reading pages:** a narrow text column centred inside the shared width.
- **The dashboard from 1024 px:** the owner was not sure, so two columns (map and stats sticky on the left, the stage list on
  the right) were chosen as the layout that uses the width best at 64 rem; a wide single column is the fallback if the
  stage list reads badly in the right column.
- **The 320 px wording** (R-8): "let's ignore old phones and focus on 375 px". The loops over 320 and 375 keep 375 alone.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-3, R-4, R-9 | planned: `e2e/layout.spec.ts` (the header, content and footer edges at 768, 1024, 1440 and 1920 px; no sideways scroll; the line length of a text page) |
| R-2 | planned: `tests/page-shell.test.ts` (no page file has a container of its own with `mx-auto max-w-`; each page uses the layout component) |
| R-5, R-6 | planned: `e2e/layout.spec.ts` (the blocks side by side from 1024 px and one column below it, on the dashboard, the Friends page and a friend's page) |
| R-7 | planned: `e2e/map.spec.ts` (the map follows a resized window) |
| R-8 | the 320 px loops of `e2e/site-logo.spec.ts`, `e2e/friends.spec.ts`, `e2e/friends-compare.spec.ts`, `e2e/language-switcher.spec.ts` are cut to 375 px |
| R-10 | existing: the footer-on-first-screen checks stay green |
| the two columns' effect on existing flows | existing: the whole `e2e/` suite stays green at 1280 x 720 (see "Done when") |

## Spec changes

Filled in when the task is built.

## Notes

Reported by the owner on 2026-10-04 with a screenshot of the Changelog at a wide window: a 720 px column in an 1800 px
window and the logo at the far left. Today every page sets its own `<main className="mx-auto max-w-3xl px-6 py-8">` (the
Friends page `max-w-xl`), and the footer's `nav` is `max-w-3xl` too; the header strip of task 0029 (`SiteLogo`) is the
full window width.

Code the work touches: `src/app/[locale]/layout.tsx`, `src/components/SiteLogo.tsx`, `src/components/Footer.tsx`, a new
layout component, every page under `src/app/[locale]/`, `src/app/not-found.tsx`.
