# 0010: Typed translation keys

Status: Done
Specs: [0005](../specs/0005-auth-routing-i18n.md) AC-7, AC-8 (this task was written as spec 0010; its behaviour now lives there)

## Goal

A typo in a translation key (`t("stampp")`) compiled and showed the raw key at runtime. Make next-intl check keys
and locales at compile time.

## Done when

- [x] Message keys are typed from `messages/en.json`; an unknown key in `useTranslations` / `getTranslations` fails `npm run typecheck` (was 0010 AC-1, now 0005 AC-7)
- [x] The locale type comes from `src/i18n/routing.ts` (was AC-2, now 0005 AC-8)
- [x] No runtime change: unit tests and E2E pass, and the bundle doesn't grow beyond the type augmentation (was AC-4)
- [ ] ICU arguments typed (was AC-3): not done, not applicable here, see Notes

## Spec changes

AC-1 and AC-2 became 0005 AC-7 and AC-8; the augmentation and the reason ICU arguments are not typed are in 0005's
notes. AC-3 (not applicable) and AC-4 (no runtime change) are not behaviour and were dropped.

## Notes

- The typing made `locale` a union instead of `string`, so the pages that read it from `params`
  (`[locale]/page.tsx`, `[locale]/dashboard/page.tsx`, `generateMetadata` in `[locale]/layout.tsx`) now narrow it
  with `hasLocale(routing.locales, locale)` and call `notFound()` otherwise, the same guard the layout's own render
  already had, so an unknown locale 404s as before.
- No wrong translation keys turned up: every `t("...")` in the code base already matched `en.json`.
- AC-3 does not apply: ICU arguments are typed from the literal type of each message string, but a JSON import
  types every value as plain `string`, and for `string` next-intl accepts any values (checked: `t("showExtras")`
  without `{count}` compiles). The literal types come from a `messages/en.d.json.ts` that next-intl's plugin
  generates (`createNextIntlPlugin`'s `createMessagesDeclaration` option, plus `allowArbitraryExtensions` in
  `tsconfig.json`). This project wires next-intl without the plugin, so it would need its own generator and a
  generated file kept in sync with every string edit. Not worth it for a handful of `{n}` / `{km}` arguments;
  `tests/messages.test.ts` already checks that all three locales use the same placeholders. Revisit if the plugin
  becomes usable here.
