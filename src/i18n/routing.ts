import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "en", "hu"],
  defaultLocale: "ru",
});
