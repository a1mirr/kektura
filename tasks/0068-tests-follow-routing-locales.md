# 0068: Tests and the smoke test follow the list of languages instead of repeating it

Status: Open
Specs: [0026](../specs/0026-automatic-deploy.md) AC-8 (the smoke test's language paths), [0005](../specs/0005-auth-routing-i18n.md) AC-8 to AC-10 (the typing and the dropdown tests), [0014](../specs/0014-pages-and-settings.md) AC-19 (the logo's E2E); a refactor, so no spec is expected to change beyond the coverage wording

## Goal

Task 0067 added German and made the specs and process documents count-free ("every language"), but several
tests and one script still spell out the list of languages or its length, so a fifth language would break them
for the wrong reason. They should read the list from `src/i18n/routing.ts` (or, for the plain-JS smoke test,
from the files that define the languages) and keep only what is genuinely per language, such as the expected
German heading, as literal fixtures.

## Done when

- [ ] The open questions below are settled with the owner
- [ ] No test or script repeats the list or the number of languages, except per-language fixtures (the expected
  text of a language) and the test that pins the list itself
- [ ] Adding a language to `routing.locales` and its `messages/<language>.json` fails only the tests that need
  per-language text, each saying what is missing; nothing else needs an edit
- [ ] `npm run check` and CI are green; fresh-context review done

## Requirements

None: this changes no behaviour. (It is a refactor of tests and of one deploy script.) It follows one rule for
tests that touch languages, set by the owner on 2026-10-04:

- Exactly one test per behaviour runs over **every** language (the list comes from `routing.locales`): the one
  that checks the language itself, such as the dropdown's options, the logo's name and link, the footer texts or
  the changelog heading, plus the deploy smoke test.
- Every other test that needs a language uses the **default** language, and, where the language is what the
  test is about (a page in another language keeps its texts, an address with a language), **one non-default**
  language, never a list. So a fifth language costs one fixture in the all-languages tests and nothing elsewhere.

## Open questions

Settled with the owner on 2026-10-04: the smoke test requests every language (it is the all-languages test of the deploy); tests follow the rule under Requirements.

- **The smoke test's list.** `scripts/smoke-test.mjs` is plain JavaScript and cannot import the TypeScript
  routing file on every Node version the deploy runs on. Derive the paths from the `messages/*.json` file names
  (simple, no TypeScript), or import `src/i18n/routing.ts` directly (one source of truth, needs Node's type
  stripping to be there)? This task leans to the file names.

## Spec changes

Filled in when the task is built.

## Notes

Places that repeat the list or the count today (to be re-checked when the task starts, after 0067 is merged):

- `e2e/account.spec.ts`: the month label must differ in exactly 4 languages (it should compare the default with one other language).
- `e2e/language-switcher.spec.ts` and `e2e/site-logo.spec.ts`: literal `["hu", "en", "de", "ru"]` loops; these become the all-languages tests, reading `routing.locales`.
- The other specs that loop over several languages (account, about, changelog, links, footer, stamping, friends): keep the default and one non-default.
- `src/i18n/typed-messages.test.ts`: the exact list of `routing.locales`; this one pins the list on purpose
  (spec 0005 AC-8) and stays.
- `tests/smoke-test.test.ts`: `CHECKS_PER_ROUND = 6` and the literal healthy answers; `scripts/smoke-test.mjs`:
  the four language paths.
- Per-language fixtures that stay literal: the logo names in `e2e/site-logo.spec.ts`, the German and other
  headings in the About, footer and changelog specs, the stamp description texts in `e2e/stamping.spec.ts`.
