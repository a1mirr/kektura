# 0058: A CI check that a review was recorded

Status: Open
Specs: [0022](../specs/0022-fresh-context-review.md) (an AC is added when this is built)

## Goal

The fresh-context review is the project's most valuable gate and the only one that lives in prose: nothing stops a
pull request from being merged with no review, or with commits added after it. Add the cheapest mechanical
tripwire: a CI job that reads the pull request description.

## Requirements

- Every pull request shows, as a CI result, whether a review was recorded at the commit it is about to merge. A job
  named `Review recorded` (pull requests only; skipped for Dependabot's) fails unless the pull request description
  has a `Reviewed commit:` line with a sha that exists, is the head of the pull request or an ancestor of it, and,
  when it is an ancestor, none of the files changed after it is anything but Markdown (`*.md`).
- A later change to any other file needs a new review and a new sha in the description (wording fixes in code or
  messages count: the author who made only a wording fix moves the sha, which is the point of having to write it).
- It proves that a review was recorded at a commit, not that it was good or that the sha was ever reviewed; the
  owner's look at the pull request stays the final gate.
- The job's name is added to the jobs that `CLAUDE.md` step 7 asks to be green before a merge.

## Done when

- [ ] `scripts/check-review-recorded.mjs`: a pure function of (description, head sha, the changed files after the reviewed commit) with the decisions above, and a thin CLI that reads them from git and the GitHub event
- [ ] A job `Review recorded` in `ci.yml` (pull requests only, skipped for Dependabot's)
- [ ] `CLAUDE.md` step 7 and the pull request template name the job
- [ ] Tests for every decision above (missing line, unknown sha, head, ancestor with only Markdown after it, ancestor with code after it, Dependabot) and for the workflow's trigger and job name
- [ ] The requirements above are written into spec 0022 as an AC, with its coverage row (spec 0034 AC-6)

## Spec changes

Filled in when built.

## Notes

- GitHub branch protection could make it required, but it is not available on a private repository without a paid plan (spec 0021); the job is a visible red mark and a line in the merge steps.
