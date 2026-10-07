# 0038: Landing page gallery of screenshots

Status: Done
Owner code: `src/components/Screenshots.tsx`, `src/app/[locale]/page.tsx` (the landing page), `src/components/PageShell.tsx` (`below`),
`src/lib/screenshots.ts`, `public/screenshots/`, `scripts/screenshots.mjs`, `scripts/lib/screenshots.mjs`, `messages/*.json`
(`home.screenshots.*`)

## Goal

A visitor who is not signed in has to trust that signing in with Google leads somewhere useful, and often decides in ten
seconds, coming from a link in a hiking group. Under the headline, the sentence and the sign-in button the landing page shows
what the app does: the dashboard with the progress numbers and the stages, the map with the blue route and the stamps, and the
route planner. The pictures are real screenshots of a demo account, made again by one command when the interface changes.

## Behaviour

### The gallery

- **AC-1**: The landing page (`/<language>`, for a visitor who is not signed in) shows, below the sign-in button, a section with its
  own `h2` and three pictures in this order: the dashboard (the numbers and the stage list), the map (full screen, the blue line over
  the stretches walked and the stamps), the route planner (a picked stretch with its distance, ascent, descent and time). Each
  picture is in a `<figure>` with a visible `<figcaption>`. The gallery is part of the page the server sends: it needs no JavaScript.
- **AC-2**: The pictures are one set, in the English interface, for every visitor; the heading, a one-line note that says so, every
  caption and every alternative text are in the visitor's language (`home.screenshots.*` in every message file, spec 0005 AC-5).
  The alternative text describes the picture and the caption says what it is for: they are not the same words.
- **AC-3**: The gallery shows and says only what the app does for everybody today: nothing that is behind a feature flag
  (Friends, spec 0024) is in a picture or a text, until its flag is on for everyone and this spec says so.

### Markup and first screen

- **AC-4**: Every picture is a `next/image` with its real `width` and `height` (so no layout shift), `loading="lazy"`, and the
  server sends it as WebP resized to the width the browser asks for (a `srcset` and `sizes` for one column on a phone, three
  columns from 768 px), smaller than the file in the repository.
- **AC-5**: On a phone (375 x 667) the headline, the subtitle and the sign-in button are fully on the first screen, in every
  language, whatever the pictures do (also when they never arrive).
- **AC-6**: The page does not scroll sideways from 320 px up, in every language. The gallery is one column below 768 px and three
  columns from 768 px, and a picture keeps its shape.
- **AC-7**: The footer follows the gallery: it is below the last picture and, with the gallery, below the first screen, at every
  width. This is the landing page only: the other full-height pages keep theirs on the first screen (spec 0036 AC-6).
- **AC-8**: A signed-in visitor of the landing page is sent to the dashboard before any of this is drawn (spec 0005 AC-2) and never
  asks for a picture.

### The pictures and how they are made

- **AC-9**: `public/screenshots/` holds exactly `dashboard.png`, `map.png` and `route.png`, PNG files of 780 x 1520 pixels (a phone,
  390 x 760 CSS pixels at a device scale of 2, `SCREENSHOT_SIZE` in `src/lib/screenshots.ts`), and all together weigh no more than
  `SCREENSHOTS_BUDGET_BYTES` (2.5 MB): a picture that grows past it fails the test, so a heavy file cannot be committed unnoticed.
- **AC-10**: `npm run screenshots` takes the three pictures from the test server (spec 0006), by default the production build on
  `http://localhost:3002` (`SCREENSHOTS_URL` changes it), in a phone-shaped Chromium window, and writes the files of AC-9. The account
  is the demo account `demo@kektura.test`, signed in through the dummy login, and the script first gives it a fixed made-up dataset:
  the first three stages stamped on three days of September 2026, the first three places of stage 4, two extra stamps; its other
  stamps are deleted. No real name, email address or friend is in the data. The map's block is left out of the dashboard picture
  (it has its own), the route is picked in the page as a user would (Tapolca to Badacsonytördemic), the OpenStreetMap attribution
  stays in the picture, and the test server's banner is taken off the page just before each shot.
- **AC-11**: Every page is checked before it is photographed, and the files are written only when all three pictures are good: a page
  that shows an email address, the test server's banner (after the banner of the freshly loaded page proved this is the test server),
  one of the app's error messages or an alert, or a picture of the wrong size, stops the run with the reason and leaves the old
  pictures alone. The script is not part of CI (the map needs OpenStreetMap's tiles) and never runs against a server that has no
  dummy login.

## Out of scope

Videos, animated demos, a carousel or an interactive demo; marketing text beyond the captions; showing the gallery to signed-in
users; a lightbox that enlarges a picture (the pictures are plain images); screenshots in other languages or in dark mode (the
interface is light only); the stamp-date field as a screen of its own.

## Notes

- The pictures are binary files in the repository, regenerated rarely: look at them before committing. The script and the demo
  dataset (`scripts/lib/screenshots.mjs`, `DEMO_WALK`) are what must stay current. The dataset is not a seed: it is applied to the demo
  account on demand and never to the test database a test starts from.
- Start the script's server with `npm run testdb:start`, then `npm run build:e2e && npm run start:e2e`: a production build has no
  development overlay in the pictures. A server started before the pictures existed has to be restarted: Next lists the files of
  `public/` when it starts.
- The gallery is a Server Component without client JavaScript; it renders through `PageShell`'s `below` slot, after the centred
  block of the hero (spec 0036 AC-4).

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/landing.spec.ts` (three figures in the order, alt and caption read from the messages, below the button, drawn once reached; with JavaScript off), `src/components/Screenshots.test.tsx` (the section, its heading and note, the figures in order, in every language), `tests/screenshots.test.ts` (the files, the keys) |
| AC-2 | `e2e/landing.spec.ts` (every language: its own texts and the same English files), `src/components/Screenshots.test.tsx`, `tests/screenshots.test.ts` (every language has the keys, long enough, and a note that names English), `tests/messages.test.ts` (the same keys and placeholders in every file) |
| AC-3 | `tests/screenshots.test.ts` (no text of the gallery mentions friends in any language); the pictures: manual (a person has to look at what is in an image): open the three files after a run and check that nothing of a flagged feature, no email and no name is on them. Last checked: 2026-10-07 (the three files of this change). |
| AC-4 | `e2e/landing.spec.ts` (attributes, the WebP the server sends and that it is smaller than the file), `src/components/Screenshots.test.tsx` (size, `lazy`, `srcset`, `sizes`), `tests/screenshots.test.ts` (the files have the size the page gives them) |
| AC-5 | `e2e/landing.spec.ts` (375 x 667 in every language; with the pictures aborted) |
| AC-6 | `e2e/landing.spec.ts` (no sideways scroll at 320, 375, 768, 1024 and 1920 px in every language; one column below 768 px, three columns from it; the shape of a picture), `src/components/PageShell.test.tsx` |
| AC-7 | `e2e/landing.spec.ts` (the footer after the last figure and below the first screen, at 375 x 667 and 1280 x 720) |
| AC-8 | `e2e/landing.spec.ts` (a signed-in visitor lands on the dashboard and no request for a picture is made) |
| AC-9 | `tests/screenshots.test.ts` (the folder holds exactly the three files; each is a PNG of the size; the total is under the budget; the script and the page agree on the size) |
| AC-10 | `tests/screenshots.test.ts` (the demo account's address, its SQL touches only its own rows and is the same every time, the walk, quoting; the files are written under the names of the screens). The real run needs Docker, a built test server and OpenStreetMap's tiles: manual (a browser, a database and the network): `npm run testdb:start`, `npm run build:e2e && npm run start:e2e`, `npm run screenshots`, then look at the three files. Last checked: 2026-10-07 (a real run). |
| AC-11 | `tests/screenshots.test.ts` (an email, the banner, an error message and an alert are each a problem, all of them are reported, the message does not repeat the address; a run that stops writes nothing and keeps the old files). The script's own checks in a real browser: manual (it needs the same set-up as AC-10): run it against a page that fails a check and see that it stops with the reason and writes nothing. Last checked: 2026-10-07 (the run stopped on a page that failed a check and wrote nothing, then passed on the demo account). |
