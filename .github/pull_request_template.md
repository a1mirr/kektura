## What and why

<!-- One or two sentences. Link the task (tasks/NNNN-slug.md) and the specs it touches (specs/NNNN-slug.md) -->

## Checklist

- [ ] The spec came first (`specs/NNNN-…`) and every acceptance criterion has a test that cites it (or a `manual` row saying how to check it), or this is a small change that needs no spec, or a task that changes no spec
- [ ] The specs this change touches mirror the code as built (an AC for new behaviour, `Removed` for dropped ones, status, coverage and both indexes true) and the task's "Spec changes" section says what changed, or the change touches no spec and says why
- [ ] `npm run check` is green; `npm run e2e` was run for changes to user flows
- [ ] Everything users can see is in the changelog (`src/content/changelog.ts`, three languages), or nothing here is visible to users
- [ ] Reviewed by a fresh-context agent (`fresh-reviewer`, spec 0022) at the commit named below; fixes that changed code, tests or behaviour were reviewed again, and later commits only fix wording; findings fixed or answered below

## Review findings

Reviewed commit: `<short sha>`

<!-- What the fresh-context reviewer found and what was done about each one ("fixed in abc1234",
     "not an issue because …"). Write "No findings" if there were none. -->
