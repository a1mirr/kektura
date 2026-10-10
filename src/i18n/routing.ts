import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["hu", "en", "de", "ru"],
  defaultLocale: "hu",
});
