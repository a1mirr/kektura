# 0036: Turn the existing specs into area specs and tasks

Status: Done
Specs: all of `specs/` (0001-0033)

## Goal

Spec 0034 says a spec describes an area as it behaves now. Most of 0001-0033 were written per change. Go through
them, check each AC against the code, and reshape them: one living spec per area, with the work that produced the
rest recorded as tasks. Do it in small steps (one area per pull request) so the tests that cite ACs and the
migrations that carry spec numbers don't all move at once.

## Done when

- [x] Every spec was read against the code, and each AC that the code does not satisfy was fixed in the code or marked `Removed` or corrected in the spec (see Progress for what was read and what is left)
- [x] Each area has one spec (the drafts fold into their area when they are built); a spec absorbed into another moves to `tasks/` (`git mv`: number and history stay), its "Spec changes" section maps old ACs to new ones, and its tests and code comments cite the new spec
- [x] Task-shaped specs became tasks (history only), their lasting rules moved into the area spec
- [x] Goals and Notes of the remaining specs describe the area, not a change
- [x] The indexes in `specs/README.md` and `tasks/README.md` are true

## Proposed grouping

A first guess from the Goal lines; decide per area while reading the code.

| Area spec | Absorbs |
| --- | --- |
| Progress and stages: 0001 | 0013 (extra stamps in stages) |
| Stamping: 0002 | 0009 (cache, instant buttons), 0016 + 0032 (stamp dates; maybe their own spec) |
| Map and route planner: 0003 | 0011 (a refactor: a task, plus its safety-net rule) |
| Trail data: 0004 | 0033 (translated descriptions) |
| Sign-in, routing, translations: 0005 | 0010 (typed keys) |
| Test server and E2E: 0006 | 0030 (faster E2E), 0031 (sharding, still Draft) |
| CI: 0007 | |
| Account and footer pages: 0014 | 0025 (account page), maybe 0015, 0018 and 0019 stay as their own pages |
| Deploy: 0020 (origin) and 0026 (automatic deploy) | one spec each or one together |
| Feature flags: 0023 | 0027 (Telegram bot), still Draft |
| Project workflow: 0021, 0022, 0034 | |
| Unchanged areas: 0008, 0012, 0015, 0017, 0018, 0019, 0024, 0028, 0029 | read against the code only |

Task-only (no lasting behaviour): 0009 and 0011 mostly, 0010, 0025, 0030, 0031.

## Progress

Folded and moved (the old file is now a task, its ACs are mapped in its "Spec changes"):

- 0002 absorbed 0009 (AC-13 to AC-16); 0016 absorbed 0032 (AC-5, AC-6, AC-9 to AC-11) and gained AC-12 for behaviour that was tested but not stated (the field follows the server's date)
- 0001 absorbed 0013 (AC-12 to AC-15)
- 0003 absorbed 0011 as AC-17 (the structure of the map code)
- 0005 absorbed 0010 (AC-7, AC-8)
- 0006 absorbed 0030 AC-1, AC-2 (AC-8, AC-9) and 0007 absorbed 0030 AC-3, AC-4 (AC-6, AC-7)
- 0014 absorbed 0025 (AC-14 to AC-18); the tests of the changelog entry about it now cite 0018 AC-7
- Stay as they are: 0004 and 0033 (two areas, trail data and the translations), 0020 and 0026 (origin helper and deploy files, and the automatic deploy), and the drafts 0023, 0027, 0028, 0029, 0031 (0027 folds into 0023 and 0031 into 0007 when they are built)

The manual coverage rows were audited in task 0039 (tests where a test could do it; a reason and a date for the rest); spec 0026 is Done.

Goals and Notes that told a story were rewritten to describe the area: 0007, 0008, 0015, 0017, 0018, 0019, 0020, 0026.

Checked against the repository, with scripts (now partly permanent: `tests/specs.test.ts`, spec 0034 AC-9):

- every AC of every spec is cited by a test title or has a `manual` coverage row (the script lists the rest: none is left that no test or manual row covers; 0002 AC-12 points to 0016, 0005 AC-2 and AC-3 are cited as "0005 AC-n" in `e2e/auth.spec.ts`)
- no test title cites an AC that does not exist; every file that a Done or Accepted spec names exists
- the links of spec 0019 all answer 200 today (2026-10-03)

Findings: the committed seeds predate the cleanup that 0004 AC-9 describes (task 0037); 0015 carried a note about `as any` that is no longer true (removed); the deploy workflow's "pick the commit" step has no retry and failed once on a GitHub API 504 (merge of #28, a docs-only change, so nothing was lost).

Read line by line against the code (2026-10-04), not only through their tests: 0008, 0015 to 0019, 0021, 0022, 0024, 0033 (0012 was re-checked in task 0039: the backup would have failed on its first run). What the reads found, all fixed in the spec unless a test is named:

- 0008 named two of the four stamp actions and covered only the stamp actions, while `src/lib/log.ts` also serves the feedback, account deletion and friends actions: new AC-5 and a test for it (the title is now "failed actions")
- 0015 described four sections but the page has a fifth ("Questions or ideas?", which holds the `/feedback` link)
- 0017: a signed-in account without an email is sent as `user <id>`, not "anonymous" (the spec said only the two); the check of the Telegram setup (AC-9) was described as a one-off run and is now `tests/telegram-check.test.ts`; a note about a rewritten migration was history and went
- 0018: two hand-checked rows did not say `manual`; the check in `tests/specs.test.ts` now also catches "review by"
- 0021 AC-6 and `CLAUDE.md` told the author to follow CI with `gh pr checks <n> --watch`, which blocks everything else: now one look, never `--watch` or a sleep loop
- 0024: profiles are also visible to the people a user asked (the policy says so), the friend functions return the friend's id next to the place ids, and a friend who stopped sharing is a name without a link and a 404 on their page (E2E already tested it)
- 0026 AC-8: the production check of the dummy login now has its date, 2026-10-04 (deploy run 37163363692, looked at in the Actions log)
- 0016, 0019, 0022, 0033: no difference found

## Spec changes

See Progress for each step; the mapping from old ACs to new ones is in the "Spec changes" of every moved task.

## Notes

- Never renumber or delete an AC of a spec that stays: a dropped one is marked `Removed`. ACs that move into another
  spec are added there as new ACs, and the old spec's file moves to `tasks/` with a map from old AC to new AC. Tests
  and code comments are re-cited in the same change.
- Migrations keep the numbers they have.
- `git grep "spec 00NN"` finds what cites a spec before it is moved.
