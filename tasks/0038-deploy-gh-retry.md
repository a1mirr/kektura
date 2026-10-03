# 0038: Retry the GitHub API calls of the deploy workflow

Status: In progress
Specs: [0026](../specs/0026-automatic-deploy.md) AC-1, AC-2, AC-3 (relied on, unchanged), AC-9 (relied on, unchanged)

## Goal

On 2026-10-03 the deploy run for the docs-only merge 7d2aa09 (run 37156261559) failed in the step "Pick the commit
to deploy" with `couldn't fetch workflows ... HTTP 504` from `gh run list`, before the docs-only skip could run. The
run failed, and so notified the developer, although nothing was wrong. The two `gh` calls of
`.github/workflows/deploy.yml` (the one that picks the commit, the one that checks CI for a run started by hand)
read state from the GitHub API once, so a single 5xx fails the deploy. They should retry a few times with a short
pause and fail only when every attempt fails, so a real failure still fails the run.

## Done when

- [x] A helper that runs a command up to four times, pausing 5, 10 and 15 seconds, and passes the last failure on,
      is defined once in the workflow and used by every `gh` call in it
- [x] `tests/deploy-workflow.test.ts` runs the helper for real: succeeds on the first try without pausing, recovers
      from transient failures, fails after the last attempt with that attempt's exit code and prints only the
      successful attempt's output; and checks that no `gh` call in the workflow is made without it
- [x] `npm run check` is green
- [ ] Fresh-context review done (spec 0022), pull request merged
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

None. Spec 0026 says what is deployed and when (AC-1 to AC-3) and that a failed step fails the run and notifies
(AC-9); all of that holds as written. How the API reads are made reliable is not behaviour the spec states.

## Notes

- Only calls that read GitHub state are retried. The server (`git push`, `git ls-remote` in
  `scripts/deploy-plan.mjs`) and the database have their own failure handling and are not touched.
- The helper retries any failure of the call, not only 5xx: a permanent error (a bad token, say) costs 30 seconds
  more and then fails the step as before.
