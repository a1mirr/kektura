import { defineRouting } from "next-intl/routing";

// The order is the order of the language dropdown: the default first.
export const routing = defineRouting({
  locales: ["hu", "en", "de", "ru"],
  defaultLocale: "hu",
});
