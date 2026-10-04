# 0005: Sign-in, routing, translations

Status: Done
Owner code: `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/app/[locale]/page.tsx`,
`src/app/[locale]/dashboard/page.tsx`, `src/i18n/*` (`routing.ts`: the languages and the default, `locale-names.ts`, `global.ts`: the typing),
`src/components/LocaleSwitcher.tsx`, `messages/*.json`

## Goal

Google sign-in through Supabase, locale-prefixed routes (Hungarian by default, `en`, `de`, `ru`) and a UI that is
complete in every language, with message keys and locales checked at compile time. The language is picked from a
dropdown, and a visitor with no signal gets Hungarian.

## Behaviour

- **AC-1**: The proxy (session refresh + locale routing) runs on every page and skips the OAuth
  callback, Next internals and files with an extension (`/data/*.json`, the MapLibre worker, ...).
  The matcher's extension escape must stay `\\.` in the TS string.
- **AC-2**: A signed-in visitor of the landing page goes straight to their dashboard. The landing
  page and the dashboard use the same session check (`getUser`), so a revoked but unexpired token
  can never bounce between them.
- **AC-3**: A signed-out visitor of the dashboard is redirected to the landing page.
- **AC-4**: The OAuth callback only ever redirects to a known locale (`?locale=` is validated) and
  shows the sign-in error on failure. After a successful sign-in it lands on the dashboard, or on the page
  named by `?next=` (a path inside the site, such as an invite link of spec 0024): it is only ever appended to
  the request's own origin and the validated locale, so it cannot point at another site.
- **AC-5**: Every message file has exactly the same keys, the same ICU placeholders per key,
  and no empty strings.
- **AC-6**: "Sign out" (a button on the account page, spec 0014 AC-16) is a plain form POST to `/auth/sign-out`: it works before the page has
  hydrated, revokes the session at Supabase from the server, clears the session cookies and returns
  to the landing page in the current locale.
- **AC-7**: Message keys are typed from `messages/en.json`, the reference locale: an unknown key or namespace in
  `useTranslations` / `getTranslations` (namespaced or not) fails `npm run typecheck`.
- **AC-8**: The `Locale` type is the union of the languages in `src/i18n/routing.ts` (today `hu | en | de | ru`), so a page that reads
  `params.locale` must narrow it with `hasLocale(routing.locales, locale)` and call `notFound()` otherwise (an
  unknown locale is a 404): the compiler refuses a plain `string`.
- **AC-9**: The default language is Hungarian (`hu`). An address without a language is sent to the language of the
  browser (the `Accept-Language` header, or the language cookie of an earlier choice) when it is one of ours, and to
  `/hu` when it is not. Everything that falls back to the default follows: the 404 page (and its logo link), an unknown
  `?locale=` of the OAuth callback and of sign-out, the request config. The addresses of every language (`/<language>`
  and all pages under it) answer; an unknown language is a 404 (AC-8).
- **AC-10**: The language is chosen from one dropdown (a native `<select>`) on the landing page and in the dashboard
  header, not from a row of buttons. It is named "Language" (translated), shows the current language and lists every
  language in the order of `routing.locales` (today `hu`, `en`, `de`, `ru`), each by its own name (Magyar, English,
  Deutsch, and Russian written in Cyrillic), never by a code. Adding a language adds an option, nothing else.
  Choosing one opens the same page in that language. It is operable with the keyboard, at least 44 px tall and fits a
  320 px screen.
- **AC-11**: German (`de`) is a full language of the site: `messages/de.json` is complete (AC-5), and the changelog
  (spec 0018), the useful links (spec 0019), the About page (spec 0015) and the stamp descriptions (spec 0033) have German text.

## Notes

- `src/i18n/global.ts` is next-intl v4's documented augmentation: `declare module "next-intl"` with an `AppConfig`
  whose `Locale` is `(typeof routing.locales)[number]` and whose `Messages` is `typeof` the `en.json` import. It only
  holds types (`import type`), so nothing of it reaches the bundle. It is a `.ts`, not a `.d.ts`, on purpose:
  `skipLibCheck` would stop `tsc` from reporting a broken import in a declaration file.
- ICU arguments are not typed (a missing `{km}` compiles). They would need the literal type of each message
  string, which a JSON import does not give: next-intl's plugin generates a declaration file next to the messages for that, and
  this project wires next-intl without the plugin (`CLAUDE.md`, `next.config.ts`). `tests/messages.test.ts` checks
  that every locale use the same placeholders instead (AC-5).

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `src/proxy.test.ts` |
| AC-2, AC-3, AC-6 | `e2e/auth.spec.ts` (test server, spec 0006) |
| AC-4 | `e2e/auth.spec.ts` (a failed code exchange, no code, an unknown locale and a markup-carrying locale all end on `/<known locale>?error=auth` on the address the user is on; a forwarded host is honoured and a malformed one is not); `src/lib/landing-path.test.ts` (`next`); the dummy login's `next` is covered by `e2e/friends.spec.ts`. The success path needs a real Google sign-in: manual (a real OAuth round trip). Last checked: never recorded. |
| AC-5 | `tests/messages.test.ts` |
| AC-9 | `src/proxy.test.ts` (`/de` runs the proxy), `e2e/language-switcher.spec.ts` (a browser in each language gets it, one in a language we don't have gets the default; every language's address answers, an unknown one is a 404), `tests/smoke-test.test.ts` (the deploy's smoke test asks for the page of every language: the message files are the routing's languages), `e2e/auth.spec.ts` (an unknown `?locale=` ends on `/hu`), `e2e/site-logo.spec.ts` (the 404 page links to `/hu`) |
| AC-10 | `e2e/language-switcher.spec.ts` (one dropdown with every language's name in order, no button row; choosing a language; on the dashboard; keyboard, 44 px, 320 px), `e2e/languages.spec.ts` (its label and value on the landing page of every language) |
| AC-11 | `tests/messages.test.ts` (parity for `de`), `src/content/changelog.test.ts`, `src/content/links.test.ts`, `tests/stamp-descriptions.test.ts`, `e2e/languages.spec.ts` (every language: the landing, About, changelog and links pages and the footer read from that language's messages file, and fit 375 px), `e2e/stamping.spec.ts` (the stamp descriptions of every language) |
| AC-7, AC-8 | `src/i18n/typed-messages.test.ts`: `// @ts-expect-error` on unknown keys and namespaces (hook and server API, namespaced and root) and on a plain `string` as `locale`, so `npm run typecheck` fails if the typing ever stops working (an unused directive is an error); `useLocale()` is `"hu" \| "en" \| "de" \| "ru"` and `"fr"` is not a `Locale` |
