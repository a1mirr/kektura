# 0018: Changelog page

Status: Done
Owner code: `src/app/[locale]/(pages)/changelog/page.tsx`, `src/content/changelog.ts`, `messages/*.json` (`changelog.*`)

## Goal

Spec 0014's `/changelog` only says "No recent updates". Give users, in their language, a readable
history of what changed in the tracker, newest first, written for hikers rather than developers (git
commit messages are not it). Adding an entry must be a small, safe edit that tests protect.

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
- **AC-6**: Today's content is the history so far in three entries: the first version (2026-09-29),
  stages and the route planner (2026-10-01), and pages, feedback, settings and stamp dates
  (2026-10-02).

## Out of scope

Release numbers; a feed (RSS); showing "what's new" inside the app; generating entries from git.

## Notes

- To add an entry, put it first in `CHANGELOG` with all three languages and run `npm test`; the tests say
  what is missing. Keep entries short; group several small changes under one title.
- The dates of the first three entries were reconstructed from migration and file timestamps; the first
  version went live earlier than any date in the git history, so they are approximate.
- Dates are plain `YYYY-MM-DD` strings shown in UTC, so they can't shift a day with the visitor's time
  zone.

## Coverage

| AC | Test |
| --- | --- |
| AC-3, AC-4 | `src/content/changelog.test.ts` |
| AC-1, AC-2, AC-6 | `e2e/changelog.spec.ts` (order, labels, three languages) |
| AC-5 | review by the owner |
