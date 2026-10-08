# 0039: Share cards

Status: Done
Owner code: `src/lib/share-card.ts`, `src/lib/share-card-server.ts`, `src/lib/share-route.ts`, `src/app/[locale]/stats/actions.ts`,
`src/app/[locale]/(pages)/share/[token]/page.tsx`, `src/app/api/share/[token]/image/route.tsx`, `src/components/SharePanel.tsx`,
`src/components/ShareMap.tsx`, `supabase/migrations/0132_share_cards.sql`, `messages/*.json` (`share.*`)

## Goal

A signed-in user can publish a **share card**: a frozen snapshot of their progress (the percentage, the stamps of the 161 places, the
kilometres, the completed stages and the trail's map with the walked part) behind an unguessable public link. Pasted into Telegram
or any messenger the link unfolds into a preview with the map and the percentage, and opening it shows a read-only page. The card is
a snapshot, not a live view: a messenger keeps the preview of an address it has seen, so a card that changed would be wrong
in the chat it was sent to. Ships behind the feature flag `share` (AC-1).

## Behaviour

### The flag

- **AC-1**: While the flag `share` (spec 0035) is off, `/<locale>/share/<token>` and `/api/share/<token>/image` answer 404, the actions
  `createShareCard` and `deleteShareCard` return `disabled` before they read the session or any share card data, and the stats page has no share panel.
  The flag is read on every request (no deploy, no restart) and is declared in `FLAGS`, with a row in the migration (`off`). The About page's paragraph on share cards (spec 0015 AC-5) shows only while it is on.

### What a card holds

- **AC-2**: A card freezes, at the moment it is created: the number of stamped places and of all places (spec 0001 AC-1), the percentage and the
  walked and remaining kilometres (AC-4 there), the completed and all stages (spec 0037 AC-3) and the walked stretches as `[from_km, to_km]`
  pairs. They come from the same functions as the dashboard's and the stats page's (`buildShareSnapshot`), computed on the server from the
  caller's own stamps: the browser sends only whether the name is shown (AC-3). The database only checks that the numbers are plausible (AC-12), so a card is
  the user's own claim, like the stamps they mark, and never anybody else's. A card holds no stamp, no stamp date, no note and no extra stamp. When the stamps cannot be read the action fails (`failed`) instead of freezing a card of 0 %.
- **AC-3**: A card is anonymous unless the owner ticks "Show my name on the card" when creating it. Then the display name of the profile (spec 0024 AC-1)
  is copied into the card, so a later rename changes nothing on cards that exist. Nothing else identifies the owner: no user id, no email, no
  stamp, on the page, in its tags, in the image or in what the database returns.
- **AC-10**: A card never changes after it is created: stamping, un-stamping or changing a date afterwards leaves it as it was. Only deleting it (AC-6) ends it. For the same reason no card is ever made from stamps that could not be read (AC-2).

### The link and the page

- **AC-4**: A card has the public address `/<locale>/share/<token>`. The token is 128 random bits written as 32 lowercase hex characters, unique, with its
  format enforced by the database. Anyone with the link, signed in or not, sees a read-only page in the language of the address, with the
  title "Kéktúra progress" (with the name, "<name>'s Kéktúra progress", AC-3), the date the card was created (a calendar day in Budapest time, the trail's own, so a card made after midnight there does not show yesterday), the percentage with a bar, the four figures
  of the stats page (stamps, kilometres, remaining kilometres, completed stages), the map (AC-5) and a link to the site's main page. A token that
  is no token, an unknown or a deleted one answers 404 and says nothing about which it was; so does a lookup that fails (the database is down), which is also logged and sent to Telegram (AC-13). The page is `noindex, nofollow` and has no sideways scroll at 375 px.
- **AC-5**: The map is the whole trail in grey with the walked stretches in blue, drawn as an SVG on the server (no map library, no JavaScript) from
  `public/data/okt-route.json` and the card's ranges (`shareMapPaths`): longitude scaled by the cosine of the middle latitude, vertices closer than 1.5 px thinned out,
  the start and the finish marked (the preview image of AC-14 draws only the trail and the walked part). The page has Open Graph and Twitter tags (`og:title`, `og:description` "N of 161 stamps · K km walked",
  `og:url`, `og:image` at an absolute address built from the request's origin, `twitter:card` `summary_large_image`), so the link unfolds into a card.
- **AC-14**: `/api/share/<token>/image` is a 1200 × 630 PNG: the name of the trail, the percentage with a bar, the stamps, the whole kilometres and the map. It
  holds no word that needs translating and no display name (the font of `ImageResponse` has no Cyrillic), so it is the same in every language. It carries
  `Cache-Control: public, max-age=3600` (a card never changes but can be deleted), answers 404 for an unknown token and 429 above 60 images drawn a minute for all visitors together. Only a drawn image counts: requests for unknown tokens answer 404 and never use up the budget.

### The owner's panel

- **AC-6**: The stats page (spec 0037) has a "Share your progress" panel below the chart, only while the flag is on. It says before anything is created that anyone with the link
  can see the card and that the walked part of the map shows roughly where the user is on the trail. It has a "Show my name on the card" checkbox (off) and a
  "Create a card" button, and lists the user's cards, newest first: the percentage and stamps, the date, whether it shows the name, the link in a read-only field (so it can be copied
  by hand when the clipboard refuses), "Copy link", "Send to Telegram" (AC-9), "Open" and "Delete". "Delete" asks first ("Delete this card? Its link stops working.") and the
  link answers 404 at once after the confirmation; "Cancel" deletes nothing.
- **AC-9**: "Send to Telegram" is a link to `https://t.me/share/url?url=<the card's address>&text=<a line in the page's language>` that opens in a new tab with `rel="noopener noreferrer"`.
  The address is built from the request's origin (spec 0020), never from user input.

### Security

- **AC-7**: `share_cards` has row level security and no privilege for `anon`; a signed-in user may only select their own rows. Nobody writes the table directly: `create_share_card`
  and `delete_share_card` are `security definer` functions with an empty `search_path`, executable by `authenticated` only, working on `auth.uid()` (a user deletes only their own card,
  and cannot create one in another's name). The public read is `get_share_card(token)`, executable by `anon` and `authenticated`, which returns the one card's date, name, numbers
  and ranges and nothing else (no user id, no row id): there is no listing and no way to ask for a user's cards.
- **AC-8**: Deleting the account (spec 0014) deletes the user's cards (`on delete cascade` of `auth.users`), and their links answer 404.
- **AC-12**: A card's numbers and ranges are checked by the database: percentages 0 to 100, no more stamps or stages done than there are, no negative km, at most 200 ranges, each a
  `[from, to]` pair of numbers with `0 <= from < to <= 2000`; otherwise `create_share_card` answers `invalid` and stores nothing. A user keeps at most 20 cards (`limit`), also when many calls arrive at once (creations of one user are serialised by a transaction-scoped advisory lock), and
  the action allows 20 creations an hour per user, answering `failed` above that.
- **AC-13**: The public read (`loadShareCard`), the read of the owner's own cards for the panel (`loadOwnShareCards`, which gives the empty list) and the actions never throw: they return an `ActionResult` (or `limit`), as the stamp and friends actions do. A failure is one `[share]` line with the action name and the error's own
  code and message, and goes to Telegram like the other actions' failures (spec 0008), except a failed read of the owner's own cards, which is only logged: never a user id, a name, a token or a number of a card.

### Texts

- **AC-11**: Every string of the panel and the page exists in `hu`, `en`, `de` and `ru` (`share.*`).

## Out of scope

A card that follows the user's progress (it would defeat the messenger's cached preview); the stamps, dates, notes or extra stamps on a card; a name of the owner in the preview image; a
public page for a user (or a list of cards) rather than for one card; changing a card after it is created (delete it and make another); counting or showing who opened a card; a share link for a
route plan or a single stage.

## Notes

- Telegram, WhatsApp and the like read `og:image` once per address and keep it, so one address is one frozen card by design (the reason for AC-10).
- The image's text is limited to digits and "Országos Kéktúra" (Latin-1 only). A display name or a translated word would need a font with Cyrillic and Hungarian double acute letters, which the 500 KB limit of `ImageResponse` makes costly.
- While the flag is in `allowlist` mode only the listed users see the page, and Telegram's crawler (signed out) gets a 404: a card is tested in a chat with the flag `on`.
- The image budget (AC-14) is shared by everybody, so someone who holds one valid link can ask for its image 60 times a minute and make every other preview answer 429 until the window passes. That is accepted: there is no shared cache in front of the server, and the cost is a minute without new previews, never a wrong one.
- The map is drawn from the card's own ranges, so it does not depend on stamps that may be changed or deleted later.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `src/app/[locale]/stats/actions.test.ts` (`disabled`, nothing touched), `e2e/feature-flags.spec.ts` (panel, page, image and the About paragraph while off, back on the next request), `tests/share-cards-database.test.ts` (the flag's row) |
| AC-2 | `src/lib/share-card.test.ts` (`buildShareSnapshot`), `src/app/[locale]/stats/actions.test.ts` (numbers computed on the server, no date, a failed stamps read fails the action), `tests/share-cards-database.test.ts` (the columns), `e2e/feature-flags.spec.ts` |
| AC-3 | `src/app/[locale]/stats/actions.test.ts`, `src/components/SharePanel.test.tsx`, `tests/share-cards-database.test.ts` (copied from the profile, kept after a rename), `e2e/feature-flags.spec.ts` (the title with the name, no email on the page) |
| AC-4 | `src/lib/share-card.test.ts` (token, address, reading a row), `src/lib/share-card-server.test.ts` (the lookup: unknown, malformed and failed tokens), `tests/share-cards-database.test.ts` (token format, public read, unknown token), `e2e/feature-flags.spec.ts` (signed-out visitor, all languages, 404s, `noindex`, no sideways scroll at 375 px) |
| AC-5 | `src/lib/share-card.test.ts` (`shareMapPaths`), `e2e/feature-flags.spec.ts` (the map and the tags) |
| AC-6 | `src/components/SharePanel.test.tsx`, `e2e/feature-flags.spec.ts` (create, copy field, delete with confirmation, the link ends, an axe scan of the stats page with the panel and of the share page at both widths, no sideways scroll of the stats page with the panel at 375 px in de, hu and ru) |
| AC-7 | `tests/share-cards-database.test.ts` (no listing, no direct write, no forged card, only own delete, grants, `security definer`) |
| AC-8 | `tests/share-cards-database.test.ts` |
| AC-9 | `src/lib/share-card.test.ts` (the address), `src/components/SharePanel.test.tsx` (new tab, `noopener`), `e2e/feature-flags.spec.ts` |
| AC-10 | `e2e/feature-flags.spec.ts` (stamping more leaves the card as it was), `src/app/[locale]/stats/actions.test.ts` (a failed read of the stamps makes no card) |
| AC-11 | `tests/messages.test.ts` (every language has the keys) |
| AC-12 | `tests/share-cards-database.test.ts` (invalid numbers and ranges, the 20 cards, also under 30 parallel calls), `src/app/[locale]/stats/actions.test.ts` (the hourly budget) |
| AC-13 | `src/app/[locale]/stats/actions.test.ts`, `src/lib/share-card-server.test.ts` (a failed lookup is a logged `exception`, the visitor gets null; a failed read of the owner's cards is a logged `read`), `src/lib/log.test.ts` |
| AC-14 | `src/app/api/share/[token]/image/route.test.ts` (404, 429, a PNG with the cache header), `e2e/feature-flags.spec.ts` (a PNG for a real card, 404 after deleting) |
