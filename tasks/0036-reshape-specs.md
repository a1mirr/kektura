# 0036: Turn the existing specs into area specs and tasks

Status: Open
Specs: all of `specs/` (0001-0033)

## Goal

Spec 0034 says a spec describes an area as it behaves now. Most of 0001-0033 were written per change. Go through
them, check each AC against the code, and reshape them: one living spec per area, with the work that produced the
rest recorded as tasks. Do it in small steps (one area per pull request) so the tests that cite ACs and the
migrations that carry spec numbers don't all move at once.

## Done when

- [ ] Every spec was read against the code, and each AC that the code does not satisfy was fixed in the code or marked `Removed` or corrected in the spec
- [ ] Each area has one spec; a spec absorbed into another moves to `tasks/` (`git mv`: number and history stay), its "Spec changes" section maps old ACs to new ones, and its tests and code comments cite the new spec
- [ ] Task-shaped specs became tasks (history only), their lasting rules moved into the area spec
- [ ] Goals and Notes of the remaining specs describe the area, not a change
- [ ] The indexes in `specs/README.md` and `tasks/README.md` are true

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

A few related areas per pull request; each step audits the area's ACs against the code and the tests (a script lists ACs that no
test cites), then folds, moves and re-cites.

- [x] Stamping, progress, map, sign-in and translations: 0002 absorbed 0009; 0001 absorbed 0013; 0003 absorbed 0011 (as AC-17, the structure); 0005 absorbed 0010 (AC-7, AC-8). Trail data (0004) and translated descriptions (0033) stay two specs: 0033 is already an area spec. Finding: the committed seeds predate the cleanup that 0004 AC-9 describes (task 0037)
- [x] Stamping detail: 0002 absorbed 0009 (AC-13 to AC-16); 0016 absorbed 0032 (AC-5, AC-6, AC-9 to AC-11) and gained AC-12 for behaviour that was tested but not stated (the field follows the server's date)

## Spec changes

Recorded per step (see Progress).

## Notes

- Never renumber or delete an AC of a spec that stays: a dropped one is marked `Removed`. ACs that move into another
  spec are added there as new ACs, and the old spec's file moves to `tasks/` with a map from old AC to new AC. Tests
  and code comments are re-cited in the same change.
- Migrations keep the numbers they have.
- `git grep "spec 00NN"` finds what cites a spec before it is moved.
