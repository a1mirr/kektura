# 0041: A CI check that a review was recorded

Status: Open
Specs: [0022](../specs/0022-fresh-context-review.md) AC-5 (added)

## Goal

The fresh-context review is the project's most valuable gate and the only one that lives in prose: nothing stops a
pull request from being merged with no review, or with commits added after it. Add the cheapest mechanical
tripwire: a CI job that reads the pull request description.

## Done when

- [ ] `scripts/check-review-recorded.mjs`: a pure function of (description, head sha, the changed files after the reviewed commit) with the decisions of AC-5, and a thin CLI that reads them from git and the GitHub event
- [ ] A job `Review recorded` in `ci.yml` (pull requests only, skipped for Dependabot's)
- [ ] `CLAUDE.md` step 7 and the pull request template name the job
- [ ] Tests for every decision of AC-5 and for the workflow's trigger and job name
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Filled in when built.

## Notes

- It checks that a review was recorded at a commit, not that it happened; a person can write a sha that was never
  reviewed. That is accepted (spec 0022, out of scope: mechanical proof is impossible).
- GitHub branch protection could make it required, but it is not available on a private repository without a paid plan (spec 0021); the job is a visible red mark and a line in the merge steps.
