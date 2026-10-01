# Specs

Every task (feature, behaviour change, non-trivial bug fix) gets a spec here **before** code. The
spec is the contract; tests prove it; the Stop hook keeps it proven.

## Workflow

1. **Write the spec.** Copy [`_template.md`](_template.md) to `specs/NNNN-short-slug.md` (next free
   number), status `Draft`. Fill in the goal, the behaviour as numbered acceptance criteria
   (`AC-1`, `AC-2`, ...), what is out of scope and open questions. Each AC is one observable,
   testable statement: "given X, when Y, then Z".
2. **Agree on it.** Resolve the open questions and set status `Accepted` before implementing.
3. **Write the tests from the ACs.** `describe("spec NNNN: <area>")`, and every test title starts
   with the AC it covers (`it("AC-3: ...")`). An AC that can't be automated yet is listed as
   `manual` in the spec's coverage table, with how to check it.
4. **Implement** until `npm run check` (typecheck + lint + tests) is green.
5. **Close the spec**: status `Done`, coverage table filled in.

Changing existing behaviour means editing the spec that owns it (add/change/remove ACs) in the same
change as the code and tests. Never delete an AC number: mark it `Removed` so old references stay
meaningful. `git grep "AC-3" -- '*0001*' 'src' 'tests'` finds a criterion's spec and tests.

## Where tests live

| What | Where | Environment |
| --- | --- | --- |
| Domain logic (pure functions) | `src/lib/*.test.ts`, next to the module | Node |
| Server actions (Supabase mocked) | next to the action, e.g. `src/app/[locale]/dashboard/actions.test.ts` | Node |
| Client components | `src/components/*.test.tsx`, first line `// @vitest-environment jsdom` | jsdom + Testing Library |
| Cross-cutting checks (generated data, translations) | `tests/*.test.ts` | Node |

Async Server Components (pages) can't be rendered by Vitest: keep their logic in `src/lib` and test
it there; list the page-level behaviour as `manual` until there are end-to-end tests.

## Regression gate

`.claude/settings.json` runs [`.claude/hooks/stop-check.mjs`](../.claude/hooks/stop-check.mjs) whenever
Claude Code is about to finish a turn with changed source files: typecheck, lint and tests in
parallel. A failure is sent back to Claude to fix (up to 3 attempts, then you get a message). If app
code changed but no spec and no test did, it asks once for the spec/test update or a one-line reason
why none is needed. Run the same checks yourself with `npm run check`.

## Index

| Spec | Area | Status |
| --- | --- | --- |
| [0001](0001-progress.md) | Progress: places, walked stretches, stats, stages | Done |
| [0002](0002-stamping.md) | Stamping: server actions and stamp buttons | Done |
| [0003](0003-map-route-planner.md) | Map lines and the route planner | Done |
| [0004](0004-trail-data.md) | Generated trail data and seeds | Done |
| [0005](0005-auth-routing-i18n.md) | Sign-in, routing, translations | Done |
