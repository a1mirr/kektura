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
- [ ] Each area has one spec; a spec absorbed into another keeps its file as a short pointer (`Status: Done`, "moved to 00NN AC-n to AC-m"), so old references still resolve, and its tests cite the new spec
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

## Spec changes

Recorded per step.

## Notes

- Never renumber or delete an AC: a moved AC is marked `Removed` in the old spec with a pointer, and added as a new
  AC in the new one. Tests are re-cited in the same change.
- Migrations keep the numbers they have.
- `git grep "spec 00NN"` finds what cites a spec before it is moved.
