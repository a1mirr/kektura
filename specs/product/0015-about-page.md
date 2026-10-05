# 0015: About page

Status: Done
Owner code: `src/app/[locale]/(pages)/about/page.tsx`, `src/lib/trail-facts.ts`, `messages/*.json` (`about.*`)

## Goal

`/about` is a real page for visitors who haven't signed in yet and for users who wonder where the numbers
come from: what the app is, how progress is counted, where the data comes from, and what happens to their data.
Everything it says is true of the app today.

## Behaviour

- **AC-1**: `/about` is public (no sign-in) in every language, reachable from the footer. It has its
  own document title and description, and a single `h1` followed by
  one `h2` per section below (the four sections of AC-2 to AC-5, then AC-8's).
- **AC-2**: "The trail in numbers" shows the number of stages, of official stamping places and the total
  length in km (one decimal), computed from `scripts/data/okt-stages.json` (the MTSZ stage table), never
  typed in by hand. Today: 27 stages, 161 places, 1,183.1 km.
- **AC-3**: "How your progress is counted" explains, in four short points:
  1. stamps can be collected in any order;
  2. a stretch between two neighbouring places counts as walked only when both are stamped, and the
     blue line, the kilometres and the percentage all come from those stretches (spec 0001 AC-3);
  3. alternative stamps at one place: collecting any of them marks the place (0001 AC-1, AC-2);
  4. extra stamps are tracked separately and never count towards the official places (0002 AC-8).
- **AC-4**: "Data and credits" names each source with a link that opens in a new tab
  (`target="_blank"`, `rel="noopener noreferrer"`, `https:` only): MTSZ / kektura.hu (stamping points,
  route, stage table), heyjoe.hu (extra stamps), OpenStreetMap contributors with MapLibre (map), and
  etteremhet.hu (restaurants, only while the restaurants layer is shown: spec 0003 AC-21). It also says the app is an independent project, not affiliated with MTSZ.
- **AC-5**: "Your data" says what is stored and what deleting does, matching spec 0014 and migration
  `0008_pages_settings.sql`:
  - Google handles the sign-in; the app stores the account (email and name from the Google profile) and
    the stamps the user marks, with their dates, and the messages sent through the feedback form, which
    are delivered to the developer together with the email when signed in (spec 0017);
  - cookies keep the user signed in, and the browser remembers display choices (which stages are open,
    which map layers are on);
  - the "Account" page deletes the account and all stamps; feedback messages already sent are kept but
    no longer linked to the user;
  - a link to `/account`;
  - while the friends feature is on (spec 0024: the `friends` flag, spec 0035): what a connected friend can see (display name,
    official stamps, kilometres, stages; no dates or extra stamps) and that sharing can be stopped on the
    Friends page. With the feature off this paragraph is not shown.
- **AC-6**: The page makes no claim that isn't true today. In particular it doesn't call the app open
  source (the repository is private) or a progressive web app (no manifest or service worker). Whoever
  makes either true edits this AC and its test.
- **AC-7**: The page text has the same keys in every locale (`tests/messages.test.ts`); each
  locale reads naturally and uses the app's own terms (`ru`: печати, этап, участок; `hu`: bélyegzőhely,
  szakasz; `de`: Stempelstelle, Etappe).
- **AC-8**: The page ends with a "Questions or ideas?" section (`h2`) that links to `/feedback`.

## Out of scope

A link to the source code (the repository is private); a version number (the changelog page has the
history); legal terms, a cookie banner and a formal privacy policy (the page describes; it isn't a legal
document).

## Notes

- Assumptions made without asking, easy to change in `messages/*.json`: the "independent project, not
  affiliated with MTSZ" sentence, and the wording of "Your data" (checked against the code and the
  migration, not against a lawyer).
- 0014 AC-2 (`/about` renders information about the app) is detailed here.
- The page narrows the locale with `hasLocale` like every other page (spec 0005 AC-8).

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/about.spec.ts` (footer link, title, headings; signed out) |
| AC-2 | `src/lib/trail-facts.test.ts` (function and the real data file), `tests/trail-data.test.ts` (matches the seed), `e2e/about.spec.ts` (shown) |
| AC-3 | `e2e/about.spec.ts` (four points, the rule's wording); the content against specs 0001 and 0002: manual (judgement): read the four points next to those specs. Last checked: never recorded. |
| AC-5 | `e2e/about.spec.ts` (links), `e2e/friends.spec.ts` (friends paragraph, flag on); the wording against spec 0014 and migration 0008: manual (judgement): read it next to them. Last checked: never recorded. |
| AC-4 | `e2e/about.spec.ts` (every external link is `https:`, opens in a new tab with `noopener`), `e2e/feature-flags.spec.ts` (the etteremhet.hu credit follows the `restaurants` flag) |
| AC-8 | `e2e/about.spec.ts` (the link to the feedback form) |
| AC-6, AC-7 | `tests/messages.test.ts` (parity incl. rich-text tags; no open-source / PWA wording in any locale), `e2e/about.spec.ts` (the default language, no overflow at 375 px), `e2e/languages.spec.ts` (every language: its title and sections, no overflow at 375 px) |
