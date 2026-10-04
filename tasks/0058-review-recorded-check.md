# 0058: A CI check that a review was recorded

Status: Done
Specs: [0022](../specs/0022-fresh-context-review.md) AC-5 (added)

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

- [x] `scripts/check-review-recorded.mjs`: a pure function of (description, head sha, the changed files after the reviewed commit) with the decisions above, and a thin CLI that reads them from git and the GitHub event
- [x] A job `Review recorded` in `ci.yml` (pull requests only, skipped for Dependabot's)
- [x] `CLAUDE.md` step 7 and the pull request template name the job
- [x] Tests for every decision above (missing line, unknown sha, head, ancestor with only Markdown after it, ancestor with code after it, Dependabot) and for the workflow's trigger and job name
- [x] The requirements above are written into spec 0022 as an AC, with its coverage row (spec 0034 AC-6)

## Spec changes

Spec 0022: AC-5 added (the "Review recorded" job and its rule), AC-4 extended (the checklist line and the section's
comment name the job), "Out of scope" narrowed from "enforcing it mechanically" to "enforcing that the review was done
and was good", Owner code and the coverage table updated (a test row and a `manual` row for the job on GitHub). Spec 0007:
a note that the workflow also holds this job, owned by 0022; no AC changed.

## Notes

- Built as: `Reviewed commit:` takes 7 to 40 hex digits (the last such line counts; HTML comments are dropped, so the
  template's unfilled `<short sha>` placeholder fails). The job reads the description through `gh api` when it runs, so
  re-running only that job after a description edit is enough (the `pull_request` event is not triggered by edits, and
  adding `edited` would rerun the end-to-end job on every edit); the author must remember that rerun, and the merge steps
  in `CLAUDE.md` say so. "Changed after the reviewed commit" is `git diff --name-only --no-renames <reviewed> <head>`.
- GitHub branch protection could make it required, but it is not available on a private repository without a paid plan (spec 0021); the job is a visible red mark and a line in the merge steps.
