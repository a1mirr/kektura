# 0029: A logo that leads home, on every page

Status: Open
Specs: [0014](../specs/0014-pages-and-settings.md) AC-1 (footer navigation: a header logo joins it), [0015](../specs/0015-about-page.md) and [0024](../specs/0024-friends-sharing.md) (the back links of the About and friends pages go)

## Goal

Most pages (about, changelog, links, feedback, account, friends) have no way back except the footer or a
text link that some of them carry, and the dashboard is a dead end of its own header. Put one logo with the
site name in the top-left corner of every page, linking to the main page, so a visitor can always get home
and the site looks like one place.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here.

- [ ] **R-1**: Every page of the site shows the logo and the name "Kéktúra" in the top-left corner, in all three
  languages, and it links to the main page of the visitor's language (`/ru`, `/en`, `/hu`). For a signed-in
  user the main page is their dashboard (the landing page redirects them, spec 0005 AC-2); for everybody else
  the landing page. "Every page" means the landing page, dashboard, account, friends (list, a friend,
  an invite), about, changelog, useful links, feedback, the error page and the 404 page.
- [ ] **R-2**: It is one component, rendered once by the locale layout (`src/app/[locale]/layout.tsx`) and by the
  404 page, which brings its own document (`CLAUDE.md` gotcha). A page does not draw its own copy, so a new page
  gets it without remembering.
- [ ] **R-3**: It is a link with an accessible name ("Kéktúra tracker: home", translated), a visible focus ring, and a
  touch target of at least 44 x 44 px. The logo image is decorative (empty `alt`) because the name next to it
  says what it is.
- [ ] **R-4**: It sits above the page content in normal flow: it does not overlap anything, does not float over the
  map's fullscreen view (which covers it), and keeps pages fitting a 320 px screen without horizontal scroll.
  The "Test server" banner of spec 0006 stays above it.
- [ ] **R-5**: The logo is a single SVG file in `public/`, rendered at a fixed size without layout shift, with
  nothing loaded from another host.
- [ ] **R-6**: The text links "back to the tracker" and "back to the start" that pages carry today (the About
  page, the friends page, spec 0015 and 0024) are removed where the logo makes them redundant, together with
  their message keys in all three languages, so nothing is left behind unused.
- [ ] **R-7**: Page headers that exist today keep their own content (the dashboard's title and links, the locale
  switcher, the page title); the logo does not replace them.

## Out of scope

A navigation menu or breadcrumbs; redesigning the page headers; a favicon, app icons or a web manifest (the
site is not a PWA, spec 0015 AC-6); a sticky or collapsing header; a dark variant (the interface is light
only); animating the logo.

## Open questions

- **The logo itself.** No logo exists in the repository. A simple mark is proposed: the trail's own blaze, a
  blue horizontal band on a white square, next to the word "Kéktúra" in the app's blue. Is that right, or is
  there artwork to use?
- **The landing page.** Show it there too (consistent, harmless: it links to the page you are on) or leave the
  landing page clean? This task assumes yes.
- **The locale switcher.** It is placed per page today (top-right on the landing page, in the dashboard
  header). Move it into the same bar as the logo, so every page has one header strip, or leave it alone for now?
- **The name.** "Kéktúra" alone or "Kéktúra tracker" (the About page and the title say "tracker")? Hungarian
  and Russian titles would differ.
- **The 404 page.** It has no locale in its URL, so its link goes to the default language's main page (`/ru`)
  unless it can read the visitor's language from the cookie. Acceptable?
- **The friends page link.** `friends.back` was added for spec 0024 only because there was no way home; it goes
  with R-6.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-3 | planned: `e2e/site-logo.spec.ts` (on every page, in the three languages: the link, its address, its accessible name; a click leads to the main page; target size) |
| R-2, R-5 | planned: `tests/site-logo.test.ts` (the layout and the 404 page render the component; no page imports it; the SVG exists and has no external references) |
| R-4 | planned: `e2e/site-logo.spec.ts` (no horizontal overflow at 320 and 375 px on each page) |
| R-6, R-7 | planned: `tests/messages.test.ts` (the removed keys are gone in all three files); review of the pages |

## Spec changes

Filled in when the task is built.

## Notes

- Today each page lays out its own `<main>` and header (the dashboard, the account page and the about page
  differ), so the logo is the first element of the body, above them; the dashboard's `<header>` stays below it.
  The `CLAUDE.md` rule that full-height pages use `flex-1` (the footer on the first screen) is not affected: the
  logo bar is a normal-height row above the `flex-grow` column.
- `src/app/not-found.tsx` is outside the locale layout and renders its own `<html>`: it cannot reuse the layout's
  component for free and needs the same component rendered by hand.
- The map's fullscreen mode (spec 0003 AC-11) is `position: fixed` and covers the bar; it needs no change.

Code the work touches: `src/components/SiteLogo.tsx`, `src/app/[locale]/layout.tsx`, `src/app/not-found.tsx`, `public/logo.svg`, `messages/*.json` (`app.home`)
