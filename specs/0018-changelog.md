# 0018: Changelog page

Status: Done
Owner code: `src/app/[locale]/(pages)/changelog/page.tsx`, `src/content/changelog.ts`, `messages/*.json` (`changelog.*`)

## Goal

`/changelog` gives users, in their language, a readable history of what changed in the tracker, newest first,
written for hikers rather than developers (git commit messages are not it). Adding an entry is a small, safe edit
that tests protect.

## Behaviour

- **AC-1**: `/changelog` is public and lists the entries of `src/content/changelog.ts`, newest first.
  Each entry has a date (shown in the page's language, e.g. "October 2, 2026"), a title and a list of
  changes. The page has its own document title and description, one `h1` and one `h2` per entry.
- **AC-2**: Each change has a kind, shown as a translated label: new, improved or fixed.
- **AC-3**: Every title and change text exists in all three languages (`ru`, `en`, `hu`) and is shown
  in the page's language. A missing translation fails the tests, never the page.
- **AC-4**: Entries have real, unique calendar dates, listed in strictly descending order and none in
  the future; each has at least one change.
- **AC-5**: The text describes what users see, and only what is true of the app as shipped.
- **AC-6**: The history up to 2026-10-02 is three entries, the oldest ones: the first version (2026-09-29),
  stages and the route planner (2026-10-01), and pages, feedback, the account page and stamp dates (2026-10-02).
  Later changes follow AC-7 (a new entry on top, or an addition to the newest entry when the dates are the
  same); how many entries there are is not pinned by any test.
- **AC-7**: A change that users can see (new, improved or fixed behaviour, a rename, a new page) adds or
  extends an entry in `src/content/changelog.ts` in the same pull request, in all three languages; changes
  users can't see (process, tests, refactors, deploy files) add none. Dates can't repeat (AC-4): a change
  made on the date of the newest entry is added to that entry, otherwise a new entry with today's date goes
  first. `CLAUDE.md` (Workflow), the pull request template and the fresh-context reviewer (spec 0022) each
  ask for it.

## Out of scope

Release numbers; a feed (RSS); showing "what's new" inside the app; generating entries from git.

## Notes

- To add an entry, put it first in `CHANGELOG` with all three languages and run `npm test`; the tests say
  what is missing. If the newest entry has today's date, add the change to it instead (AC-7). Keep
  entries short; group several small changes under one title.
- The dates of the first three entries were reconstructed from migration and file timestamps; the first
  version went live earlier than any date in the git history, so they are approximate.
- Dates are plain `YYYY-MM-DD` strings shown in UTC, so they can't shift a day with the visitor's time
  zone.

## Coverage

| AC | Test |
| --- | --- |
| AC-3, AC-4 | `src/content/changelog.test.ts` |
| AC-1, AC-2 | `e2e/changelog.spec.ts` (order, labels, three languages; expectations come from `src/content/changelog.ts`, so a new entry doesn't break them) |
| AC-6 | `src/content/changelog.test.ts` (the three oldest entries are these, in this order), `e2e/changelog.spec.ts` (the oldest entry is the first version) |
| AC-5 | manual (judgement): the text is read against what the app does. Last checked: every pull request (the fresh-context review, spec 0022, reads the changelog of the change). |
| AC-7 | `tests/review-process.test.ts` (`CLAUDE.md`, the pull request template and the reviewer's brief ask for it) |
| AC-7 (an entry exists and is true) | manual (judgement): the change is compared with the entry. Last checked: every pull request (the fresh-context review, spec 0022). |
