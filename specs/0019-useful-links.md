# 0019: Useful links page

Status: Done
Owner code: `src/app/[locale]/(pages)/links/page.tsx`, `src/content/links.ts`, `messages/*.json` (`links.*`)

## Goal

Spec 0014's `/links` has a single link. Make it a short, curated, grouped list of places a Kéktúra
hiker needs, each with a line saying what it is, in the user's language.

## Behaviour

- **AC-1**: `/links` is public, with its own document title and description, one `h1`, a short intro and
  one labelled section (`h2`) per group: the trail, planning a hike, community and data.
- **AC-2**: Each link shows its name (a proper noun, not translated) as a link, and after it a
  translated one-line description.
- **AC-3**: Every link is `https:`, opens in a new tab with `rel="noopener noreferrer"`, and the intro
  says that they lead to websites that aren't ours.
- **AC-4**: Every link has a description in all three languages (the message-parity test), links are
  unique, and every group has at least one link. The list is data (`src/content/links.ts`), so
  adding a link is one entry plus three sentences.
- **AC-5**: Only links that were checked are listed: each answered with HTTP 200 on 2026-10-02 and its
  page says what the description says. Today's list:
  - the trail: kektura.hu (official site), kektura.hu/okt-szakaszok (stages and GPX files),
    the MTSZ stage table (PDF), mtsz.org (the association behind it), Wikipedia (English);
  - planning: menetrendek.hu (intercity timetables), met.hu (weather), turistautak.hu (maps),
    OpenStreetMap;
  - community and data: heyjoe.hu (hike registry, source of the extra stamps), etteremhet.hu (restaurants).

## Out of scope

Affiliate or sponsored links; automatic link checking in CI (it would make the build depend on third-party
sites being up); per-language link lists.

## Notes

- Not listed on purpose: pages that couldn't be verified (a train timetable site whose page has no title,
  a guessed address that doesn't exist).
- Check a new link before adding it: `curl -sIL <url>` should end in 200, and its title should match the
  description.

## Coverage

| AC | Test |
| --- | --- |
| AC-3 (https, unique), AC-4 | `src/content/links.test.ts`, `tests/messages.test.ts` |
| AC-1, AC-2, AC-3 (new tab, rel) | `e2e/links.spec.ts` |
| AC-5 | checked by hand on 2026-10-02 (status and page titles) |
