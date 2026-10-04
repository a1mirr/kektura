## What and why

<!-- One or two sentences. Link the task (tasks/NNNN-slug.md) and the specs it touches (specs/NNNN-slug.md) -->

## Checklist

- [ ] The task came first (`tasks/NNNN-…`, its requirements and open questions settled before coding), every requirement holds, and every acceptance criterion written for it has a test that cites it (or a `manual (reason)` row saying how to check it and when it was last checked), or this is a small change that needs no task, or a task that changes no spec
- [ ] The specs this change touches mirror the code as built and describe nothing that is not built (an AC for new behaviour, `Removed` for dropped ones, status, coverage and both indexes true) and the task's "Spec changes" section says what changed, or the change touches no spec and says why
- [ ] `npm run check` is green and CI's end-to-end job is green (`npm run e2e` locally only to reproduce a failure), or skipped because only Markdown changed
- [ ] Everything users can see is in the changelog (`src/content/changelog.ts`, every language), or nothing here is visible to users
- [ ] Reviewed by a fresh-context agent (`fresh-reviewer`, spec 0022) at the commit named below; fixes that changed code, tests or behaviour were reviewed again, and later commits only fix wording; findings fixed or answered below; CI's "Review recorded" job is green

## Review findings

Reviewed commit: `<short sha>`

<!-- CI's "Review recorded" job reads the line above: a sha (7 to 40 hex digits) of the head or of an ancestor with only
     Markdown changed after it. Change any other file after the review and the sha has to move to a new review. After
     editing this description, re-run that job of the newest run: gh run rerun <run-id> --job <job-id> -->

<!-- What the fresh-context reviewer found and what was done about each one ("fixed in abc1234",
     "not an issue because …"). Write "No findings" if there were none. -->
