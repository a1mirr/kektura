# 0010: Typed translation keys

Status: Done
Owner code: `src/i18n/global.ts`, `src/i18n/typed-messages.test.ts`

## Goal

A typo in a translation key (`t("stampp")`) currently compiles and shows the raw key at runtime. Make
next-intl check keys and locales at compile time.

## Behaviour

- **AC-1**: Message keys are typed from `messages/en.json`, the reference locale: an unknown key in
  `useTranslations` / `getTranslations` (namespaced or not) fails `npm run typecheck`.
- **AC-2**: The locale type comes from `src/i18n/routing.ts` (`ru | en | hu`).
- **AC-3** (not applicable, see Notes): Where next-intl supports it, ICU arguments are typed (a
  missing `{km}` argument fails the typecheck).
- **AC-4**: No runtime change: unit tests and E2E pass, and the bundle doesn't grow by more than the
  type augmentation.

## Notes

`src/i18n/global.ts` is next-intl v4's documented augmentation: `declare module "next-intl"` with an
`AppConfig` whose `Locale` is `(typeof routing.locales)[number]` and whose `Messages` is `typeof` the
`en.json` import. It only holds types (`import type`), so nothing of it reaches the bundle. It is a
`.ts`, not a `.d.ts`, on purpose: `skipLibCheck` would stop `tsc` from reporting a broken import in a
declaration file.

The typing made `locale` a union instead of `string`, so the pages that read it from `params`
(`[locale]/page.tsx`, `[locale]/dashboard/page.tsx`, `generateMetadata` in `[locale]/layout.tsx`)
narrow it with `hasLocale(routing.locales, locale)` and call `notFound()` otherwise, the same guard
the layout's own render already had, so an unknown locale 404s as before. No wrong translation keys turned up: every `t("...")` in the code base already matched
`en.json`.

**AC-3 does not apply.** ICU arguments are typed from the literal type of each message string, but a
JSON import types every value as plain `string`, and for `string` next-intl accepts any values (checked:
`t("showExtras")` without `{count}` compiles). The literal types come from a `messages/en.d.json.ts`
that next-intl's plugin generates (`createNextIntlPlugin`'s `createMessagesDeclaration` option, plus
`allowArbitraryExtensions` in `tsconfig.json`; checked by hand that TypeScript then picks the file up).
This project wires next-intl without the plugin (CLAUDE.md, `next.config.ts`), so it would need its
own generator and a generated file in `messages/` kept in sync with every string edit. Not worth it for
a handful of `{n}` / `{km}` arguments; `tests/messages.test.ts` already checks that all three locales
use the same placeholders. Revisit if the plugin becomes usable here.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `src/i18n/typed-messages.test.ts`: `// @ts-expect-error` on unknown keys and namespaces (hook and server API, namespaced and root), so `npm run typecheck` fails if the typing ever stops working (verified: removing `global.ts` makes every one of them an "unused directive" error) |
| AC-2 | `src/i18n/typed-messages.test.ts` (`useLocale()` is `"ru" \| "en" \| "hu"`, `"de"` is not a `Locale`, a plain `string` is not accepted as `locale`) |
| AC-3 | n/a, see Notes |
| AC-4 | `npm run check`, `npm run build`, `npm run e2e` |
