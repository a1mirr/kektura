# 0033: Translated stamp descriptions

Status: Done
Owner code: `src/content/stamp-descriptions.json`, `src/lib/stamp-description.ts`,
`src/app/[locale]/dashboard/page.tsx`, `src/app/[locale]/(pages)/friends/[id]/page.tsx`

## Goal

Where to find each stamp ("on the post by the entrance, to the right of the gate") is only published in
Hungarian by MTSZ and heyjoe.hu. A visitor reading the site in Russian, English or German can't use it. Every
description is also available in `ru`, `en` and `de`; Hungarian visitors keep the original text.

## Behaviour

- **AC-1**: The description of a place's stamps (dashboard and a friend's page, spec 0024) and of an extra
  stamp (dashboard) is shown in the language of the page: `ru`, `en` and `de` use the translation of that stamp, `hu`
  uses the original Hungarian text from the database.
- **AC-2**: A stamp without a translation in the page's language shows the Hungarian original (never an empty
  line). Today every stamp has every translation (AC-3).
- **AC-3**: Every stamp code in `supabase/seed.sql` and `supabase/seed_extra.sql` has a non-empty `en`, `ru` and `de`
  translation in `src/content/stamp-descriptions.json`, and the file has no entry for a code that is no longer
  in the seeds. After the trail data is regenerated (spec 0004), a new or renamed stamp makes the tests fail
  until it is translated.
- **AC-4**: A translation keeps the technical marker codes of the original, for example `(NDB020INF)` and
  `(OKTPH_21_1)` at the end of a place description, in the same order, so the stamp can be matched with MTSZ's
  tables and the posts in the field. A translation is a translation: it differs from the Hungarian text, except a description that is only a street
  address ("József Attila u. 5."), which is the same in every language.
- **AC-5**: The Hungarian original stays in the database and in the seeds as the single source (spec 0004); the
  translations are ours, kept in the repository, and are not changed by regenerating the seeds.

## Out of scope

Names of places and stamps (proper names, shown as published); reviewing the translations with native speakers
(they were written by Claude and not proofread, the German ones too: wording fixes are welcome as pull requests); other languages;
user-submitted translations.

## Notes

- Hungarian proper names (places, businesses, streets) stay in Latin letters in the Russian text, so they match
  the names shown beside them; the descriptive words are translated. German keeps the Hungarian
  street and place names too and writes the descriptive words in German.
- The JSON is only read by Server Components (the pages), so it isn't part of the browser bundle.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2 | `src/lib/stamp-description.test.ts`, `e2e/stamping.spec.ts` (en/hu/ru/de) |
| AC-3, AC-4 | `tests/stamp-descriptions.test.ts` |
| AC-5 | `tests/stamp-descriptions.test.ts` (the seed generator and the seed do not mention the translations file) |
