# 0010: Typed translation keys

Status: Accepted
Owner code: `src/i18n/`, a `global.d.ts` (or the place next-intl's docs prescribe)

## Goal

A typo in a translation key (`t("stampp")`) currently compiles and shows the raw key at runtime. Make
next-intl check keys and locales at compile time.

## Behaviour

- **AC-1**: Message keys are typed from `messages/en.json`, the reference locale: an unknown key in
  `useTranslations` / `getTranslations` (namespaced or not) fails `npm run typecheck`.
- **AC-2**: The locale type comes from `src/i18n/routing.ts` (`ru | en | hu`).
- **AC-3**: Where next-intl supports it, ICU arguments are typed (a missing `{km}` argument fails the
  typecheck).
- **AC-4**: No runtime change: unit tests and E2E pass, and the bundle doesn't grow by more than the
  type augmentation.

## Notes

Follow next-intl v4's documented TypeScript augmentation (`AppConfig`). Fix every type error it
reveals in existing code; a real wrong key found this way is a bug fix worth calling out.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-3 | `src/i18n/typed-messages.test.ts`: `// @ts-expect-error` on a wrong key (and a missing argument if AC-3 applies), so `tsc` fails if the typing ever stops working |
| AC-2, AC-4 | `npm run check`, `npm run e2e` |
