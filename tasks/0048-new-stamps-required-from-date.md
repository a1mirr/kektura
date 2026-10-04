# 0048: New stamps are required only from their official date

Status: Open
Specs: [0001](../specs/0001-progress.md) AC-1, AC-3 (walked stretches: waived places), [0003](../specs/0003-map-route-planner.md) (the popup note), [0004](../specs/0004-trail-data.md) (the dates file, AC-1 to AC-3, the regeneration steps), [0015](../specs/0015-about-page.md) (facts stay true), [0024](../specs/0024-friends-sharing.md) AC-7, AC-8, AC-12 (a friend's figures and what the friend functions return)

## Goal

Make the walked-stretch rule aware of when a stamp was introduced, using only the MTSZ's published dates, so a hiker who
walked before a stamp existed is not shown as missing it, and so an added stamp can never renumber, drop or devalue anybody's
progress.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] `scripts/data/okt-stamp-dates.json` holds the fifteen codes (fourteen places) of the Notes below, each re-checked against
      its source and entered under the seed's current code (Lokó-pihenő is `OKTPH_84_B` there), and the migration `0048_checkpoint_required_from.sql` is applied
      locally first
- [ ] The rule, the numbering safeguards (ids kept, labels display-only, counts from data) and the interface (date, hint, waived
      state) are built with the tests under "Tests to write"
- [ ] A friend's figures equal their dashboard, through a server function that shares only the waived place keys
- [ ] `npm run types:gen`; `npm run e2e`; the changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0048, 0049 and 0050 (R-1 to R-35): they were one piece of planning, and the three tasks refer to each other's numbers.

### Dates and sources

- [ ] **R-1**: A checkpoint has an optional `required_from` date (`YYYY-MM-DD`, nullable). Null means "required from the
  beginning": the place has no entry in the dates file, or its entry has no `required_from` (a moved stamp that is not new). A place's `required_from` is the earliest of
  its variants' (spec 0001 AC-1).
- [ ] **R-2**: Dates come **only from official publications** of the MTSZ (kektura.hu, mtsz.org), never from guesses or
  third parties. They live in one data file, `scripts/data/okt-stamp-dates.json`: one entry per stamp code with any of the
  optional dates `required_from` and `moved_on` (R-31), the URL of the publication that gives each, and, only where that
  publication says so, a `tolerance_note` flag (R-15). `build-data.mjs` reads it (spec 0004: outputs are never edited by hand). Entries are added by hand when the MTSZ
  announces a change, like the stage table. The code is the **current** code in the seed: the MTSZ renames codes (see
  Notes), so an entry for an older code is entered under the code the seed has now.
- [ ] **R-3**: A test checks every entry: the code exists in the seed, every date present is a real date, the source is an
  `https://www.kektura.hu/...` or `https://www.mtsz.org/...` address, `tolerance_note` is a boolean when present, no code
  appears twice.

### New stamps: the rule

A stamp put up on a date is required from that date: a hiker who passes the place on or after it must have its stamp
in the book, or the stretch is not verified; one who passed earlier is not missing anything.

- [ ] **R-4**: "When the user walked it" is read from the stamp dates (spec 0016) of the nearest stamped places on either
  side of the place that has no stamp of its own. The stretch is walked **on** the later of those two dates. If that
  date is **before** the place's `required_from`, the missing stamp is not required: the place does not block the
  stretch. If it is **on or after** `required_from`, the stamp is required and the place blocks the stretch like an
  unstamped place does today (spec 0001 AC-3: not verified).
- [ ] **R-5**: A user with stamps on both sides of a place whose `required_from` is later than both dates has the stretch
  counted as walked although the place has no stamp. If they stamp it later (on any date) nothing is lost (the km then move to the later of the months, task 0047 R-6). Changing a
  neighbour's date (spec 0016, bulk: task 0053) can make a stretch verified or unverified; the stage list says why (R-14).
- [ ] **R-6**: Walked km, the stats of spec 0001 AC-4 and the monthly figures (task 0047) all follow R-4 and R-5 and
  stay consistent: the months add up to the walked km. A stretch across a waived place is one stretch between the stamped
  places on either side of it, dated by the later of their two dates (task 0047 R-6). A place without a date behaves
  exactly as before.
- [ ] **R-7**: The count "N / 161" keeps its denominator when a place is waived: the waiver concerns stretches. A waived
  place is shown as "not required for your walk" and is not counted as missing in its stage.
- [ ] **R-8**: A new place inside a stretch a user had already walked does not reduce that user's progress when they
  walked before its `required_from`. (Without the rule, inserting P between A and B turns A-B into A-P and P-B and, with
  P unstamped, removes the whole stretch from the km, the percentage, the monthly figures and the "stage complete"
  state of everyone who walked it.) A test builds that case, and the opposite one: A and B stamped after P's date, the
  stretch is not walked.

### Numbering when a stamp is added

The code of a new stamp is stable (`OKTPH_97_B` is inserted beside `OKTPH_97`) and so is its database id; the label the
app shows (`19.6`, from the stage table's order) and the trail order shift for the places after it in the stage
(Martonyi kolostorrom became 25.2 and pushed Tornabarakony from 25.2 to 25.3).

- [ ] **R-9**: A user's stamps are tied to a stamp's code and database id, never to its label or position. Adding a stamp
  never moves, deletes or re-dates a stamp the user has. A test regenerates the seed with a place inserted in the
  middle of a stage and checks that every existing code keeps its `id` and users' stamps still point at the same codes.
- [ ] **R-10**: Labels (`stage.n`) are display only: nothing stores or links to one (no URL, stored value, friend
  message or anchor; stage sections are addressed by the stage number). A test fails if a label is used as a key or in
  a link.
- [ ] **R-11**: The counts the app shows (the "N / 161" of the dashboard and friends, the About page's facts, the stage
  progress) come from the data, never from a constant, so a new place changes them in the same change as the seed.
- [ ] **R-12**: A friend's figures equal the friend's own dashboard (spec 0024 AC-8), waived places included. Friends'
  dates are not shared, so the waivers are decided on the server from the friend's own stamp dates and only their result
  is shared, never the dates, by a function only authenticated users may call (`anon` revoked, as in spec 0024 AC-12). (Open question: the set of waived places itself tells a friend that the other walked there
  before a date.) This changes what spec 0024 AC-12 says the friend functions return (only the friend's id and place ids).
- [ ] **R-13**: Adding a stamp is one recipe in the repository (spec 0004, "Regenerating"): the new GPX and stage table, a
  dates entry, the seed, the checks of R-9 to R-11, and the changelog line where users can see the change.

### New stamps: the interface

- [ ] **R-14**: In the stage list, a place with a `required_from` shows it ("Stamp required from 8 May 2025", localized)
  next to its name; where the user's dates waive it, "not required for your walk". The map's popup says the same.
- [ ] **R-15**: Every place that has a `required_from` shows a hint (a short text in the row) and a tooltip or popover on the
  date, reachable by tap and by keyboard, not by hover only, that explains the date without repeating it: "This stamp became
  required on that day; a hiker who walked earlier is not missing it." For entries flagged `tolerance_note` it adds: "The MTSZ
  allows a one-month tolerance after the date when a booklet is inspected." The hint states the MTSZ's rule; the stats do not
  apply the tolerance (R-4 uses the date itself), so a stretch walked inside the month shows as unverified and the
  hint is how the user learns it may still be accepted. The tolerance sentence is shown only for entries that are
  flagged `tolerance_note` in the dates file, set only where an official announcement says it (2025 and 2026).
- [ ] **R-16**: The stage's progress counts a waived place as done for the stage's "complete" state but shows it
  distinctly (not as a checked stamp).
- [ ] **R-17**: Dates, hints and notes are translated in `ru`, `en` and `hu`; they wrap under the place's name at 320 and
  375 px and work on desktop.

## Out of scope

Temporary warnings, detours, closures and construction notices (the MTSZ's own warnings page covers them);
automatic detection of changes (see Open questions); counting or drawing the old route of a retired stamp; stamps of
the Alföldi and Dél-dunántúli trails; stamps retired before 2014; the history of a stamp's earlier locations;
letting a user declare their own waivers.

## Open questions

- **How to judge when the user walked.** R-4 reads it from the neighbours' stamp dates. Someone who stamps everything
  in one evening after the walk gets that day for every stamp, so a new place looks required. Acceptable (dates can be
  fixed, specs 0016 and task 0053), or should the user be able to say "I walked this before it existed" per place or stage?
- **Which neighbour.** R-4 uses the later neighbour date, the strict choice; the earlier is the lenient one. Which fits
  how the MTSZ verifies a book? (R-21 uses the earlier, for a different reason: showing versus requiring. Same choice
  for both, or keep the split?)
- **The one-month tolerance.** R-15 only informs; should a stretch walked inside the month show as "tolerated" instead
  of unverified?
- **Older changes.** The MTSZ's list of recent years starts in 2014. A stamp introduced earlier has no published date and
  counts as required from the beginning. Is there an older official list, or is that enough?
- **Replaced stamps.** Vércverés replaced Nyírjesi-erdészház on a re-routed trail. The proposal: it is treated like any new
  stamp, by the official date (2014-11-21), because a hiker on the old route never passed Vércverés. Should Vércverés
  also carry a note "before 2014 the stamp was at the Nyírjesi forester's house, about 5 km away"?
- **The Vércverés date.** The official list says 2014-11-21; a hikers' forum (not official) dates the move 2014-10-05.
  This task uses the official date.
- **Stamp codes change.** The Lokó-pihenő case above shows the MTSZ renumbering codes, so a code is not a permanent identity
  for the dates file or for users' stamps. Spec 0004 AC-9 covers a dropped code only when the place key stays. Does a
  renumbering need its own rule (a mapping from old to new code kept in the data)?
- **A partly known walk date.** R-4 reads the walk date from the stamped neighbours on either side. If a waived place has a
  stamped neighbour on one side only, which date counts? And does the stage header's "x of y" count a waived place?
- **Friends and waivers.** R-12 proposes a `security definer` function that returns only the waived place keys for an
  accepted, sharing friend. But a waived place is an unstamped place walked before a date, so the set discloses a coarse
  walk date, against spec 0024's promise that friends see no dates. Acceptable, or should a friend's page instead show
  numbers that may differ from their own dashboard (with a note), or only totals computed on the server?

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-2, R-3 | planned: `tests/trail-data.test.ts` (dates valid, from the source, codes in the seed) |
| R-4, R-5, R-6, R-7, R-8 | planned: `src/lib/progress.test.ts` (a waived place between stamped neighbours, before and after the date, a stamp added later, the sum of the months) |
| R-9, R-10, R-11 | planned: a database test beside `tests/seed-cleanup.test.ts` (the ids are `serial`, so keeping them can only be checked against the database: apply a seed with an inserted place and check that every code keeps its id and users' stamps), `tests/labels.test.ts`; the E2E counts follow the data |
| R-12 | planned: `tests/friends-migration.test.ts` (the function returns only waived keys, only for accepted sharing friends), `src/lib/friends.test.ts` |
| R-13 | planned: `tests/trail-data.test.ts` (spec 0004's "Regenerating" section names the dates file, the retired file and the checks of R-9 to R-11) |
| R-14, R-15, R-16, R-17 | planned: `src/components/StageSection.test.tsx`, `e2e/stamping.spec.ts` (375 px), `tests/messages.test.ts` |

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04. The rule as the owner put it: a hiker who passes a stage after a stamp was introduced
must have the stamp in the book, or it is not verified. The dates come from the MTSZ's posts of 2014 to 2026 (see the
notes above); the numbering behaviour was checked in `supabase/seed.sql` and `scripts/data/okt-stages.json`.

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
- The 2025 announcement states the rule of R-4: a hiker who completed a section before the date need not go back for
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
- `buildPlaces` and `walkedRanges` take stamps without dates today: the rule needs the dates in them (and in the
  friends' summary, `summarizeFriend`).

Code the work touches: `scripts/data/okt-stamp-dates.json` (new), `scripts/data/okt-retired-stamps.json` (new), `scripts/build-data.mjs`, `src/lib/progress.ts`, `src/lib/map-popups.ts`, `src/components/trail-map/*`, `src/components/StageSection.tsx`, `src/app/[locale]/dashboard/actions.ts`, `supabase/migrations/` (one per task)
