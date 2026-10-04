# 0067: Hungarian is the default language, German is added, and the language is chosen from a dropdown

Status: Done
Specs: [0005](../specs/0005-auth-routing-i18n.md) (AC-5, AC-8 changed; AC-9, AC-10, AC-11 added), [0014](../specs/0014-pages-and-settings.md) AC-14, AC-16, AC-18, AC-19 (the dropdown and German names), [0033](../specs/0033-translated-stamp-descriptions.md) (a German description for every stamp), [0018](../specs/0018-changelog.md) AC-3, [0015](../specs/0015-about-page.md) AC-7, [0026](../specs/0026-automatic-deploy.md) AC-8 (the smoke test's language paths); wording only in 0019, 0022, 0034

## Goal

The Országos Kéktúra is a Hungarian trail and most of the people who walk it read Hungarian, so a visitor with no
other signal should land on Hungarian, not Russian. German is the next language of hikers on the trail, so the
site gets a fourth language. With four languages a row of buttons stops fitting a phone-width header, so the
language is chosen from a dropdown instead.

## Done when

- [x] The open questions below are settled with the owner before any code is written
- [x] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built. They are written into the owning specs as the behaviour is built; until then they live here.

- [x] **R-1**: The default language is Hungarian (`hu`). A visitor whose address has no language, whose browser
  language is none of ours, or whose language cookie names an unknown language, gets Hungarian. The places that
  fall back to the default today follow: the 404 page and its logo link (task 0029), the OAuth callback and
  sign-out redirects (spec 0005 AC-4, AC-6), the request config.
- [x] **R-2**: German (`de`, "Deutsch") is a fourth language of the site: `/de` and `/de/...` work like the other
  languages, and `Locale` becomes `hu | en | ru | de` (spec 0005 AC-8: `"de"` is a `Locale`; the test that says it
  is not is rewritten). Every place that lists the languages (the proxy tests, the smoke test) includes it.
- [x] **R-3**: Every user-visible string exists in German: `messages/de.json` has exactly the keys of
  `messages/en.json` and the same placeholders (spec 0005 AC-5); the changelog (every entry, spec 0018 AC-3), the
  useful links, the About page and the stamp descriptions (all 292 codes, spec 0033 AC-3) have German text. A
  German visitor never sees English or Russian text by accident.
- [x] **R-4**: The language is chosen from a dropdown, not a row of buttons. It shows the current language and
  lists all four in the order Magyar, English, Deutsch and Russian (in its own script), each by its own name, not a code, and choosing one
  opens the same page in that language (as today). It is keyboard operable, has an accessible name ("Language",
  translated), a touch target of at least 44 px, and fits a 320 px header.
- [x] **R-5**: Existing links and bookmarks keep working: `/ru`, `/en`, `/hu` and everything under them are
  unchanged. Only the address without a language (`/`) and unknown languages are affected by the new default.
- [x] **R-6**: The deploy smoke test, the E2E tests that name a language, and the changelog check cover German,
  and a changelog entry tells hikers about the new language and the new default.

## Out of scope

Language detection beyond what next-intl does today (Accept-Language, cookie); a different date or number format
per language beyond what `Intl` already gives; German versions of place names (proper names stay as published);
native-speaker review of the German text (like spec 0033's, it is not proofread: wording fixes are welcome as pull
requests); other languages; translating the specs or the repository's own docs.

## Open questions

Settled with the owner on 2026-10-04:

- **Dropdown kind:** the owner left it to us: a native `<select>` (phones, keyboard and screen readers for free; it needs JavaScript to switch, as the buttons do today).
- **Where it lives:** unchanged, per page where it is today (landing page, dashboard header).
- **German content scope:** everything: the interface, the changelog, the links, the About page and all 292 stamp descriptions (written by Claude, not proofread).
- **Order:** Hungarian, English, German, Russian.
- **Browser language:** the language is picked from the browser's language when the address has none (next-intl's detection, as today); only a visitor with no matching signal gets Hungarian. No announcement beyond the changelog entry.
- **404 page:** the owner left it to us: it follows the default language, so it is Hungarian.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1 | planned: E2E (the bare `/` and an unknown `Accept-Language` land on `/hu`; `/ru`, `/en`, `/de` stay), `src/proxy.test.ts` |
| R-2 | planned: `src/i18n/typed-messages.test.ts` (`Locale` is `hu \| en \| ru \| de`), `src/proxy.test.ts` (`/de` runs the proxy) |
| R-3 | planned: `tests/messages.test.ts` (parity for `de`), `src/content/changelog.test.ts`, `src/content/links.test.ts`, `tests/stamp-descriptions.test.ts` (every code has a `de` text, marker codes kept) |
| R-4 | planned: `e2e/language-switcher.spec.ts` (the dropdown on the landing page, dashboard and account; names; choosing a language; keyboard; 320 px; target size) and a component test |
| R-5 | planned: E2E (the old language addresses still answer 200 and keep their language) |
| R-6 | planned: `tests/smoke-test.test.ts`, `e2e/changelog.spec.ts` |

## Spec changes

- Spec 0005: the Goal and Owner code name the languages (Hungarian default, `en`, `de`, `ru`), `routing.ts`, `locale-names.ts` and the switcher; AC-5 says "every message file"; AC-8's `Locale` is `hu | en | de | ru`; new AC-9 (the default language and the browser's language), AC-10 (the dropdown) and AC-11 (German is a full language), with coverage rows; the typing row now says `"fr"` is not a `Locale`.
- Spec 0014: AC-14 names the dropdown, AC-14/16/18 add the German words, the coverage rows add `de`.
- Spec 0033: Goal, AC-1 and AC-3 and the Notes cover `de`; the coverage row names the four languages.
- Spec 0018: AC-3 lists the four languages. Spec 0015: AC-7 adds German terms. Spec 0026: AC-8's smoke test requests `/hu`, `/en`, `/de` and `/ru`.
- Specs 0019, 0022, 0034 and `CLAUDE.md`, the PR template, the reviewer's brief and the Stop hook's message: "all three languages" became "every language" so the next language needs no sweep.

## Notes

- The default language is set in `src/i18n/routing.ts` (`defaultLocale`); the places that read it are
  `src/i18n/request.ts`, `src/app/not-found.tsx`, `src/app/auth/callback/route.ts` and `src/app/auth/sign-out/route.ts`.
- `LocaleSwitcher` (`src/components/LocaleSwitcher.tsx`) is a client component of buttons that calls
  `router.replace(pathname, { locale })`.
- `scripts/smoke-test.mjs` checks `/en` and `/ru`; a German path joins it.
- `Locale`-keyed records (the changelog's `Localized`, `DescriptionTranslations`, the `messages/*.json` imports in
  tests) are typed from `routing.locales`, so adding `de` makes the compiler list what is missing.
- Task 0029 (the site logo) adds `app.name`, `app.home` and a 404 link to `/ru`: whichever merges second adds the
  German text and the new default for those.
