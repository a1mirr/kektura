# 0028: Screenshots on the landing page

Status: Open
Specs: [0005](../specs/0005-auth-routing-i18n.md) (the landing page), [0015](../specs/0015-about-page.md) (texts stay true)

## Goal

A visitor who is not signed in sees a headline, one sentence and a sign-in button, and has to trust that
signing in with Google leads somewhere useful. Show what the app does before asking for a sign-in: the
dashboard with the progress numbers and the stages, the map with the route and the stamps, the route planner.
For people who found the link in a hiking group and decide in ten seconds.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here.

- [ ] **R-1**: The landing page (the page a signed-out visitor sees at `/`, spec 0005) shows a short gallery of
  three or four screenshots below the sign-in button, each with a caption, in the visitor's language. Signed-in
  users still go straight to the dashboard (0005 AC-2) and never load the images.
- [ ] **R-2**: The screenshots show the real app with a **demo account only**: made-up stamps, no real name, email
  or friend, and nothing that identifies a user. They are taken from the test server (spec 0006) with a fixed
  demo dataset by `npm run screenshots` (Playwright), so they can be made again when the interface changes, and
  the generated images are committed in `public/screenshots/`.
- [ ] **R-3**: Everything the captions and alt texts claim is true of the app today (the rule of spec 0015 AC-6):
  a feature that is behind a flag (friends, 0024) is not shown or mentioned until its flag is on for everyone.
- [ ] **R-4**: Every image has an alternative text and a visible caption in `ru`, `en` and `hu`, the same keys in
  all three files (`tests/messages.test.ts`), and sits in a `<figure>` with a `<figcaption>`.
- [ ] **R-5**: The images cost the first screen nothing: they have explicit `width` and `height` (no layout shift),
  load lazily, are served in a modern format at the size they are displayed (`next/image`), and the headline,
  subtitle and sign-in button stay visible without scrolling on a phone (375 x 667) whatever the images do.
- [ ] **R-6**: The page has no horizontal scroll from 320 px up, in all three languages. The gallery is a single
  column on a phone and two columns or a row from a wider screen.
- [ ] **R-7**: The footer follows the gallery (see the open question about the "footer on the first screen" rule).
- [ ] **R-8**: A budget keeps the page light: all screenshots together stay under a size agreed in this task's
  tests, and a screenshot that grows past it fails the test, so a heavy PNG can't be committed unnoticed.
- [ ] **R-9**: `npm run screenshots` fails (and writes nothing) when the demo account's page shows an email
  address, the "Test server" banner or an error, so a broken run can't replace good images.

## Out of scope

Videos, animated demos, a carousel or an interactive demo; marketing text beyond the captions; showing the
screenshots to signed-in users; a lightbox that enlarges an image (see the open questions); screenshots in
dark mode (the interface is light only).

## Open questions

- **Which screens.** The dashboard (numbers and stage list), the map with the blue route and stamps, the
  route planner with a picked stretch, the stamp-date field? Three or four, in what order?
- **One language or three.** The interface texts are part of the screenshots: three sets (ru, en, hu, nine to
  twelve images, the visitor sees the right one) or one set in English for everybody? Three is truer to the
  app but triples what has to be regenerated and reviewed.
- **The map.** It uses OpenStreetMap tiles, which a headless run in CI may not load (spec 0006 Notes); take
  the map shot locally only, or with tiles mocked from a saved image? The OSM attribution has to be visible
  in the image as it is in the app.
- **The footer rule.** `CLAUDE.md` says full-height pages such as the landing page use `flex-1` so the footer
  stays on the first screen. A gallery pushes the footer below the fold on purpose. Change the rule for the
  landing page only (and 0005's wording), or put a compact strip of thumbnails that keeps the footer visible?
- **Enlarging.** Is a plain image enough, or should a tap open it larger (a lightbox is more code and more
  tests: focus trap, Esc)?
- **Mobile-first look.** Phone-shaped screenshots (the app on a phone, which is how it is used on the trail)
  or desktop-width ones?

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-3, R-4 | planned: `e2e/landing.spec.ts` (images load, alt and caption in the three languages, nothing for a signed-in user), `tests/messages.test.ts` |
| R-2, R-9 | planned: `scripts/screenshots.mjs` self-checks (fails on an email, the test banner or an error); manual: look at the images before committing them |
| R-5, R-6, R-7 | planned: `e2e/landing.spec.ts` (the button is in the viewport at 375 x 667; no overflow at 320 and 375 px; footer after the gallery) |
| R-8 | planned: `tests/screenshots.test.ts` (files present, formats, total size under the budget) |

## Spec changes

Filled in when the task is built.

## Notes

- The images are binary files in the repository, regenerated rarely; the script and the demo dataset (a seed
  next to `supabase/seed_extra.sql`, test database only) are what must stay current.
- The landing page is a Server Component; the gallery needs no client JavaScript.
- `e2e/auth.spec.ts` and the other landing page tests already run at the default size; the 375 px test of this
  task is new, as for the About page (`e2e/about.spec.ts`).

Code the work touches: `src/app/[locale]/page.tsx`, `src/components/Screenshots.tsx`, `scripts/screenshots.mjs`, `public/screenshots/`, `messages/*.json` (`home.screenshots.*`)
