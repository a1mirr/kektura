# 0042: Stamp lifecycle: new, retired and moved stamps

Status: Draft
Owner code: `scripts/data/okt-stamp-dates.json` (new), `scripts/data/okt-retired-stamps.json` (new),
`scripts/build-data.mjs`, `src/lib/progress.ts`, `src/lib/map-popups.ts`, `src/components/trail-map/*`,
`src/components/StageSection.tsx`, `src/app/[locale]/dashboard/actions.ts`, `supabase/migrations/` (one per task)

Amends, when built: [0001](0001-progress.md) AC-1 (the row count changes with retired rows), AC-3 (walked stretches: waived
places) and AC-7 (stage stamping skips retired rows); [0003](0003-map-route-planner.md) (popups and markers: required-from and
moved notes, no retired rows); [0004](0004-trail-data.md) AC-1 to AC-3 (the order, the 161 places and the labels are checked on
current rows only), AC-9 (retired rows are kept) and its regeneration steps; [0015](0015-about-page.md) (the trail facts and the
freshness line stay true); [0016](0016-stamp-dates.md) AC-1 to AC-4 (a retired stamp is stamped with a chosen past date and
edited under the same limit); [0017](0017-feedback.md) (the form accepts a stamp code from the link); [0024](0024-friends-sharing.md)
AC-7 and AC-12 (what a friend's functions return).

## Goal

The trail is not fixed in time: the MTSZ adds stamps, retires them and moves them. This area says how the tracker
treats each, using only the MTSZ's own announcements: a stamp **required from** a date is not demanded of a hiker who
walked before it; a **retired** stamp stays in the record of the people who could have collected it; a **moved** stamp
shows its latest location on the map. Whatever changes, nobody's stamps are lost and nobody's progress drops for
a rule they could not have known. It works on desktop and on a phone.

## Behaviour

### Dates and sources

- **AC-1**: A checkpoint has an optional `required_from` date (`YYYY-MM-DD`, nullable). Null means "required from the
  beginning": the place has no entry in the dates file, or its entry has no `required_from` (a moved stamp that is not new). A place's `required_from` is the earliest of
  its variants' (spec 0001 AC-1).
- **AC-2**: Dates come **only from official publications** of the MTSZ (kektura.hu, mtsz.org), never from guesses or
  third parties. They live in one data file, `scripts/data/okt-stamp-dates.json`: one entry per stamp code with any of the
  optional dates `required_from` and `moved_on` (AC-31), the URL of the publication that gives each, and, only where that
  publication says so, a `tolerance_note` flag (AC-15). `build-data.mjs` reads it (spec 0004: outputs are never edited by hand). Entries are added by hand when the MTSZ
  announces a change, like the stage table. The code is the **current** code in the seed: the MTSZ renames codes (see
  Notes), so an entry for an older code is entered under the code the seed has now.
- **AC-3**: A test checks every entry: the code exists in the seed, every date present is a real date, the source is an
  `https://www.kektura.hu/...` or `https://www.mtsz.org/...` address, `tolerance_note` is a boolean when present, no code
  appears twice.

### New stamps: the rule

A stamp put up on a date is required from that date: a hiker who passes the place on or after it must have its stamp
in the book, or the stretch is not verified; one who passed earlier is not missing anything.

- **AC-4**: "When the user walked it" is read from the stamp dates (spec 0016) of the nearest stamped places on either
  side of the place that has no stamp of its own. The stretch is walked **on** the later of those two dates. If that
  date is **before** the place's `required_from`, the missing stamp is not required: the place does not block the
  stretch. If it is **on or after** `required_from`, the stamp is required and the place blocks the stretch like an
  unstamped place does today (spec 0001 AC-3: not verified).
- **AC-5**: A user with stamps on both sides of a place whose `required_from` is later than both dates has the stretch
  counted as walked although the place has no stamp. If they stamp it later (on any date) nothing is lost (the km then move to the later of the months, spec 0041 AC-6). Changing a
  neighbour's date (spec 0016, bulk: 0044) can make a stretch verified or unverified; the stage list says why (AC-14).
- **AC-6**: Walked km, the stats of spec 0001 AC-4 and the monthly figures (spec 0041) all follow AC-4 and AC-5 and
  stay consistent: the months add up to the walked km. A stretch across a waived place is one stretch between the stamped
  places on either side of it, dated by the later of their two dates (spec 0041 AC-6). A place without a date behaves
  exactly as before.
- **AC-7**: The count "N / 161" keeps its denominator when a place is waived: the waiver concerns stretches. A waived
  place is shown as "not required for your walk" and is not counted as missing in its stage.
- **AC-8**: A new place inside a stretch a user had already walked does not reduce that user's progress when they
  walked before its `required_from`. (Without the rule, inserting P between A and B turns A-B into A-P and P-B and, with
  P unstamped, removes the whole stretch from the km, the percentage, the monthly figures and the "stage complete"
  state of everyone who walked it.) A test builds that case, and the opposite one: A and B stamped after P's date, the
  stretch is not walked.

### Numbering when a stamp is added

The code of a new stamp is stable (`OKTPH_97_B` is inserted beside `OKTPH_97`) and so is its database id; the label the
app shows (`19.6`, from the stage table's order) and the trail order shift for the places after it in the stage
(Martonyi kolostorrom became 25.2 and pushed Tornabarakony from 25.2 to 25.3).

- **AC-9**: A user's stamps are tied to a stamp's code and database id, never to its label or position. Adding a stamp
  never moves, deletes or re-dates a stamp the user has. A test regenerates the seed with a place inserted in the
  middle of a stage and checks that every existing code keeps its `id` and users' stamps still point at the same codes.
- **AC-10**: Labels (`stage.n`) are display only: nothing stores or links to one (no URL, stored value, friend
  message or anchor; stage sections are addressed by the stage number). A test fails if a label is used as a key or in
  a link.
- **AC-11**: The counts the app shows (the "N / 161" of the dashboard and friends, the About page's facts, the stage
  progress) come from the data, never from a constant, so a new place changes them in the same change as the seed.
- **AC-12**: A friend's figures equal the friend's own dashboard (spec 0024 AC-8), waived places included. Friends'
  dates are not shared, so the waivers are decided on the server from the friend's own stamp dates and only their result
  is shared, never the dates, by a function only authenticated users may call (`anon` revoked, as in spec 0024 AC-12). (Open question: the set of waived places itself tells a friend that the other walked there
  before a date.) This changes what spec 0024 AC-12 says the friend functions return (only the friend's id and place ids).
- **AC-13**: Adding a stamp is one recipe in the repository (spec 0004, "Regenerating"): the new GPX and stage table, a
  dates entry, the seed, the checks of AC-9 to AC-11, and the changelog line where users can see the change.

### New stamps: the interface

- **AC-14**: In the stage list, a place with a `required_from` shows it ("Stamp required from 8 May 2025", localized)
  next to its name; where the user's dates waive it, "not required for your walk". The map's popup says the same.
- **AC-15**: Every place that has a `required_from` shows a hint (a short text in the row and a tooltip or popover on the
  date, reachable by tap and by keyboard, not by hover only) shows a tooltip or popover that explains the date without repeating it: "This stamp became
  required on that day; a hiker who walked earlier is not missing it." For entries flagged `tolerance_note` it adds: "The MTSZ
  allows a one-month tolerance after the date when a booklet is inspected." The hint states the MTSZ's rule; the stats do not
  apply the tolerance (AC-4 uses the date itself), so a stretch walked inside the month shows as unverified and the
  hint is how the user learns it may still be accepted. The tolerance sentence is shown only for entries that are
  flagged `tolerance_note` in the dates file, set only where an official announcement says it (2025 and 2026).
- **AC-16**: The stage's progress counts a waived place as done for the stage's "complete" state but shows it
  distinctly (not as a checked stamp).
- **AC-17**: Dates, hints and notes are translated in `ru`, `en` and `hu`; they wrap under the place's name at 320 and
  375 px and work on desktop.

### Retired stamps

A retired stamp is the mirror of a new one: the people who walked before the retirement collected it, and it belongs in
their record. Example: Vércverés replaced Nyírjesi-erdészház on 2014-11-21.

- **AC-18**: A retired stamp is a checkpoint row that is **kept**: it has a `retired_on` date (the first day it is no
  longer valid), optionally the place that replaced it (`replaced_by`, a place key) and where it sat
  (`after_place_key`, the current place it followed in trail order, so it has a position in its stage). Current stamps
  have `retired_on` null. Its `place_key` is its own code (non-null and unique, so stamping by key works). A retired row is outside the 161 places and the trail order: its `seq` is above every current
  row's, its `stage_seq` is null (its place in the list comes from `after_place_key`), its `km_from_start` is that of the
  place it follows (not measured), and `buildPlaces` and the checks of spec 0004 AC-1 to AC-3 look at current rows only.
- **AC-19**: Retired stamps come from `scripts/data/okt-retired-stamps.json`: code, name, stage, `after_place_key`,
  `retired_on`, `replaced_by`, optional `lat` and `lng` (from an official source, kept for the record: a retired stamp is never a map marker, AC-24) and
  the official URL, under the rules of AC-2 and AC-3. `build-data.mjs` writes them as
  rows with `retired_on` set and never deletes one (this amends spec 0004 AC-9: rows the source no longer has are
  deleted, except retired ones).
- **AC-20**: A user's stamps are never lost when a stamp is retired: regenerating the seed for a stamp that becomes
  retired keeps every `user_stamps` row on it and does not move them to another variant.
- **AC-21**: A retired stamp appears in its stage's list, at its position, for a user if **either** they already have a
  stamp on it (always) **or** their walk date is before `retired_on`. The walk date is read as in AC-4 but with the
  **earlier** of the two neighbouring dates: the stamp was collectable if the user passed any time before the
  retirement. With no stamped neighbour and no stamp of its own it is not shown.
- **AC-22**: A toggle on the stage controls, "Show retired stamps" (off by default, remembered like the other stage-list
  preferences), shows every retired stamp, for a user who walked the old route without stamping neighbours first.
- **AC-23**: A retired stamp has no "today" default (spec 0016 AC-1 would date it after `retired_on`): ticking it opens its
  date field and the stamp is created with the date the user enters, which must be before `retired_on` (and obey spec 0016
  AC-2). Editing the date (`setStampDate`) or changing it in bulk (spec 0044) follows the same rule. Unlike spec 0016 AC-3
  (an out-of-range date on creation is ignored and the default applies), a date on or after `retired_on`, or no date at all (the database default would be today), is refused as `failed`, without a write:
  the action reads `retired_on` first, as it already reads `checkpoints` for the ids. A request that mixes a retired stamp with
  others is refused as a whole. The field's `max` is the day before.
- **AC-24**: Retired stamps never count towards "N / 161", the walked km, the stage's "complete" state or the monthly
  counts (spec 0041). They show on their own: "Retired stamps collected: n" under the stage list and a separate mark
  in the stage row. (The old route is not in the data, so no stretch can be drawn or measured.) A retired stamp never
  blocks a stretch: it is a record, not a requirement. It is also left out of "Stamp stage" (spec 0001 AC-7), the map's
  markers, the route planner and the hops, although its row has coordinates.
- **AC-25**: A retired stamp's row carries a short note, visible without a hover, in three languages: "Retired stamp:
  valid until 20 Nov 2014. Replaced by Vércverés." The replacement is a link to its row when there is one. The row is
  muted with a "retired" badge (not by colour alone) and its checkbox's accessible name includes "retired". The
  replacing stamp's own note mentions the retired one, so the two rows explain each other.
- **AC-26**: A friend's page does not list retired stamps and counts none of them: it filters them out of what
  `get_friend_stamps` returns.
- **AC-27**: The notes wrap at 320 and 375 px, and the badge does not push the date field off the screen.

### Moved stamps

A stamp that moved keeps its code and its place; only where it is changes. The map must show where it is **now**, so
that anyone who relies on the site's map finds it.

- **AC-28**: A moved stamp keeps its code, place and database id (AC-9); its coordinates, description and, if they
  changed, km and stage position change. The map (the dashboard's, the popups, the route planner, a friend's) and the
  stage list show only the current location; the old one is not drawn anywhere. A move is not a retirement plus a new
  stamp: users' stamps stay with their dates and no `required_from` applies. A move that comes with a new code is a
  replacement and follows the retired and new rules above.
- **AC-29**: A stamp's popup and row show the MTSZ's current description of where exactly it is, as the data holds it,
  and the coordinates are those of the same data; the marker, the popup and the "locate me" distance (spec 0003) use
  them.
- **AC-30**: Where a move changes the route, the route line, the km of the places after it and the stage table follow
  the same MTSZ publication. A stamp is never shown at a place the drawn line does not pass: a test checks every place's
  distance to the line against a limit written in the test (spec 0004 only prints places over 500 m away today).
- **AC-31**: A stamp that moved (a change of its coordinates of more than 100 m between two MTSZ files; a smaller shift
  just replaces the coordinates) in the last 180 days has a `moved_on` date, an entry in the dates file of AC-2 (the date,
  the official publication's URL), and `build-data.mjs` fails when the coordinates of a code differ by more than 100 m from
  the previous seed without such an entry. For those 180 days its row and popup show a short note: "Moved on 30 Sep 2026: the stamp
  is now by the lookout. If you use an older map or booklet, check the new place." It says only what the data holds
  (the date and the new description), not how far or which way. Its marker on the map has a ring (not colour alone).
- **AC-32**: A move reaches the site as one routine: the new MTSZ file, `node scripts/build-data.mjs ...`, the checks,
  the seed applied to production, the reference-data cache expired (spec 0002 AC-15: otherwise the old place is served for
  up to 24 hours) and the deploy, ending with a read-only check that production serves the new coordinates for the moved
  code. This is the recipe of AC-13.
- **AC-33**: The site says how fresh its trail data is: "Trail data: MTSZ file of 15 Apr 2026" (the date of the GPX
  file used, written into the generated data by `build-data.mjs`), on the About page and under the map.
- **AC-34**: A stamp's popup has a "Report a wrong location" link to the feedback form (spec 0017), `?stamp=<code>`: only a
  stamp code travels in the URL, it is checked against the seed, and the stamp's name is looked up on the server; the link
  carries no free text, so nobody can craft a link that puts words into a visitor's form. The form uses its existing rate
  limit and honeypot.
- **AC-35**: The notes, ring and link work on the dashboard map and, where a friend's map exists (spec 0043), on it, at
  320 and 375 px and on desktop; the link has a touch target of at least 44 x 44 px.

## Out of scope

Temporary warnings, detours, closures and construction notices (the MTSZ's own warnings page covers them);
automatic detection of changes (see Open questions); counting or drawing the old route of a retired stamp; stamps of
the Alföldi and Dél-dunántúli trails; stamps retired before 2014; the history of a stamp's earlier locations;
letting a user declare their own waivers.

## Open questions

- **How to judge when the user walked.** AC-4 reads it from the neighbours' stamp dates. Someone who stamps everything
  in one evening after the walk gets that day for every stamp, so a new place looks required. Acceptable (dates can be
  fixed, specs 0016 and 0044), or should the user be able to say "I walked this before it existed" per place or stage?
- **Which neighbour.** AC-4 uses the later neighbour date, the strict choice; the earlier is the lenient one. Which fits
  how the MTSZ verifies a book? (AC-21 uses the earlier, for a different reason: showing versus requiring. Same choice
  for both, or keep the split?)
- **The one-month tolerance.** AC-15 only informs; should a stretch walked inside the month show as "tolerated" instead
  of unverified?
- **Older changes.** The MTSZ's list of recent years starts in 2014. A stamp introduced earlier has no published date and
  counts as required from the beginning. Is there an older official list, or is that enough?
- **Replaced stamps.** Vércverés replaced Nyírjesi-erdészház on a re-routed trail. The proposal: it is treated like any new
  stamp, by the official date (2014-11-21), because a hiker on the old route never passed Vércverés. Should Vércverés
  also carry a note "before 2014 the stamp was at the Nyírjesi forester's house, about 5 km away"?
- **The Vércverés date.** The official list says 2014-11-21; a hikers' forum (not official) dates the move 2014-10-05.
  This draft uses the official date.
- **Data for retired stamps.** The MTSZ list gives only the name and the date. The retired stamp's code, coordinates and
  stage position are not in it, and a web search found no code. They must come from an official source (an older GPX of
  the stamping places, or the 2009 booklet). Should the stamp wait for it, or ship with the position entered by hand?
- **Does a missing retired stamp unverify a stretch?** By the mirror of AC-4, someone who walked before the change needed
  the old stamp. AC-24 says it never blocks (nobody can collect it any more). Does the MTSZ still require it for an old
  booklet?
- **Per-month chart.** AC-24 leaves retired stamps out; a stamp collected in June 2013 is still a stamp that month.
  Include it in the month's stamp count of spec 0041, with km untouched?
- **Stamp codes change.** The Lokó-pihenő case above shows the MTSZ renumbering codes, so a code is not a permanent identity
  for the dates file or for users' stamps. Spec 0004 AC-9 covers a dropped code only when the place key stays. Does a
  renumbering need its own rule (a mapping from old to new code kept in the data)?
- **A partly known walk date.** AC-4 reads the walk date from the stamped neighbours on either side. If a waived place has a
  stamped neighbour on one side only, which date counts? And does the stage header's "x of y" count a waived place?
- **Retired stamps in the chart** is asked here and in spec 0041; settle it once, in the stats spec.
- **Detecting changes.** Nothing notices a change on the MTSZ site; the dates, the files and the seed are entered by hand.
  A scheduled check of the MTSZ news and GPX file that opens an issue would close the gap. Wanted, as a task of its own?
- **Friends and waivers.** AC-12 proposes a `security definer` function that returns only the waived place keys for an
  accepted, sharing friend. But a waived place is an unstamped place walked before a date, so the set discloses a coarse
  walk date, against spec 0024's promise that friends see no dates. Acceptable, or should a friend's page instead show
  numbers that may differ from their own dashboard (with a note), or only totals computed on the server?

## Notes

**Official dates found** (to seed `scripts/data/okt-stamp-dates.json`; check each code against the GPX and the seed, and
re-check against the source, when entering it):

| Code | Place | Required from | Source |
| --- | --- | --- | --- |
| `OKTPH_103` | Vércverés (replaced Nyírjesi-erdészház) | 2014-11-21 | [list of new stamps](https://www.kektura.hu/hir/az-elmult-evek-uj-kektura-belyegzohelyeinek-listaja) |
| `OKTPH_84_B` | Lokó-pihenő (listed by the MTSZ as `OKTPH_85_2`) | 2017-05-26 | same list |
| `OKTPH_142` | Nagy-nyugodó | 2017-06-11 | same list |
| `OKTPH_31_B` | Csobánc | 2017-10-27 | same list |
| `OKTPH_132_B_1`, `_2` | Encs (verify before entering: a new place, as the `_B` suffix suggests, or a second stamp at an existing one) | 2022-05-01 | same list |
| `OKTPH_30_B` | Badacsony | 2025-05-08 | [new stamps, 2025](https://www.kektura.hu/hir/uj-belyegzok-a-kekturan) |
| `OKTPH_63_C` | Nagy-Gete | 2025-05-08 | same |
| `OKTPH_80_B` | Julianus-kilátó | 2025-05-08 | same |
| `OKTPH_83_B` | Csóványos | 2025-05-08 | same |
| `OKTPH_86_B` | Naszály | 2025-05-08 | same |
| `OKTPH_128_B` | Irota | 2025-05-08 | same |
| `OKTPH_147_B` | Nagy-Milic | 2025-05-08 | same |
| `OKTPH_97_B` | Tepke | 2026-06-11 | [six new stamps, 2026](https://www.kektura.hu/hir/hat-uj-belyegzovel-bovul-a-kektura-2026-ban) |
| `OKTPH_126_B` | Martonyi kolostorrom | 2026-06-11 | same (printed there as `OKTHP_126_B`, a typo; the seed has `OKTPH_126_B`) |

- Not a new place: Bodó-rét (`OKTPH_148`) got a new imprint in 2025. The new stamps of the Alföldi and Dél-dunántúli trails
  are not part of this app. The 2017 list calls Lokó-pihenő `OKTPH_85_2`; the seed has it as `OKTPH_84_B` (stage 18, place 1;
  `OKTPH_85` is Magyarkút), so the MTSZ has renumbered codes since: enter dates by the seed's code, and match an old
  announcement to its place by name and position, not by the code printed in it.
- Dates are entered exactly as the source prints them (year, month and day); a source that gives only a month is not entered
  until the day is found in an official publication.
- The 2025 announcement states the rule of AC-4: a hiker who completed a section before the date need not go back for
  the stamp; one who completes it after must have it. The current stamp tables are PDFs on kektura.hu's
  "okt-szakaszok" page; they list the stamps now valid, not when each was introduced, so the news posts remain the
  source of dates.
- **The one-month tolerance** is stated in the posts of
  [2025-05-08](https://www.kektura.hu/hir/uj-belyegzok-a-kekturan) and
  [2026-06-11](https://www.kektura.hu/hir/hat-uj-belyegzovel-bovul-a-kektura-2026-ban): during inspection of a completion
  booklet a month is given, after which a missing new stamp must be made up (*hiánypótlás*). The older posts say nothing
  of it.
- **What a new stamp changes today** (checked in `supabase/seed.sql`, `scripts/data/okt-stages.json` and
  `scripts/build-data.mjs`): the seed is upserted by `code`, so ids and users' stamps are untouched, while `seq`,
  `stage_seq` and `km_from_start` are rewritten. `stage` and `stage_seq` come from the position in the stage table,
  extracted by hand from the MTSZ PDF: a new place needs a table row, or the build fails on purpose ("places without a
  stage"). The stage and total km, the hops of the route planner and the route files change with the new GPX. Not
  verified: whether the MTSZ booklet renumbers its pages when a stamp is added; the codes (`_B`, `_C`) suggest not.
- **Vércverés, what changed** (`OKTPH_103`, stage OKT-20): the official list says only that it replaced Nyírjesi-erdészház
  (2014-11-21). Background from a hikers' forum thread
  ([third party](https://www.teljesitmenyturazoktarsasaga.hu/okt_forum&a=dh&id=103), context only, not checked against
  the thread itself): the marking in the Mátra changed after the Mátra-nyereg, so the Kéktúra stopped passing the
  Nyírjesi forester's house, whose stamp (on the gate's fence, in the 2009 booklet) was about 5 km from the new one on the
  699 m Vércverés summit. So the route changed, not only the stamp. The seed has no Nyírjesi row (it is the current MTSZ
  data), so a pre-2014 stamp there cannot be recorded today.
- Other changes the MTSZ makes, seen on its pages: stamps with two locations at one place (Encs, 2022: `_1` and
  `_2`, handled by spec 0004; whether Encs was a new place or an older one is to be verified), a new imprint (Bodó-rét), and "stamp in a new place" notices on the
  [warnings page](https://www.kektura.hu/figyelmeztetesek) (2026-09-30 Virágos-nyereg, 2026-09-24 Nyírkarász; which trail
  each belongs to is not checked). The Zalakomár (2019) and Jakab-hegy (2022) replacements are on the Dél-dunántúli trail.
- Today a move already reaches users once the seed is regenerated: `build-data.mjs` upserts by `code` and rewrites
  `lat`, `lng`, `description` and `km_from_start`. What is missing is the routine (AC-32), the freshness (AC-33), the
  note (AC-31) and the report link (AC-34). The map data is the generated JSON in `public/data/` plus the database rows,
  both from one run of the build script; a test that they agree on every stamp's coordinates is planned (AC-29).
- `buildPlaces` and `walkedRanges` take stamps without dates today: the rule needs the dates in them (and in the
  friends' summary, `summarizeFriend`).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3 | planned: `tests/trail-data.test.ts` (dates valid, from the source, codes in the seed) |
| AC-4, AC-5, AC-6, AC-7, AC-8 | planned: `src/lib/progress.test.ts` (a waived place between stamped neighbours, before and after the date, a stamp added later, the sum of the months) |
| AC-9, AC-10, AC-11 | planned: a database test beside `tests/seed-cleanup.test.ts` (the ids are `serial`, so keeping them can only be checked against the database: apply a seed with an inserted place and check that every code keeps its id and users' stamps), `tests/labels.test.ts`; the E2E counts follow the data |
| AC-12 | planned: `tests/friends-migration.test.ts` (the function returns only waived keys, only for accepted sharing friends), `src/lib/friends.test.ts` |
| AC-13 | planned: `tests/trail-data.test.ts` (spec 0004's "Regenerating" section names the dates file, the retired file and the checks of AC-9 to AC-11) |
| AC-14, AC-15, AC-16, AC-17 | planned: `src/components/StageSection.test.tsx`, `e2e/stamping.spec.ts` (375 px), `tests/messages.test.ts` |
| AC-18, AC-19, AC-20 | planned: `tests/trail-data.test.ts` (the retired file and the generated seed), and a database test beside `tests/seed-cleanup.test.ts` (a retired row kept and its stamps kept after a regeneration) |
| AC-21, AC-24 (the rules) | planned: `src/lib/progress.test.ts` |
| AC-22, AC-24 (the toggle, its memory, the count and the mark) | planned: `src/components/StageControls.test.tsx`, `src/components/StageSection.test.tsx` |
| AC-23 | planned: `src/app/[locale]/dashboard/actions.test.ts`, `src/lib/stamp-date.test.ts` |
| AC-25, AC-26, AC-27 | planned: `src/components/StageSection.test.tsx`, `src/lib/friends.test.ts`, `e2e/stamping.spec.ts` (375 px) |
| AC-28, AC-29, AC-30 | planned: `tests/trail-data.test.ts` and a database test beside `tests/seed-cleanup.test.ts` (a moved coordinate keeps ids and stamps; the distance to the line within the limit; the JSON and the seed agree on every stamp's coordinates), `src/lib/map-popups.test.ts` |
| AC-31 | planned: `src/lib/stamp-moves.test.ts` (the 100 m threshold, the 180-day window), `src/lib/map-layers.test.ts` (the ring) |
| AC-32 | manual (a real deploy and production data): follow the checklist of spec 0004 and run the read-only query on production. Last checked: never recorded. |
| AC-33 | planned: `tests/trail-data.test.ts` (the generated data carries the file date), `e2e/about.spec.ts` |
| AC-34, AC-35 | planned: `e2e/map.spec.ts` (the link; 375 px), `src/lib/feedback.test.ts` (only a known stamp code is accepted, nothing else from the URL reaches the form) |
