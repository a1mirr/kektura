import type { routing } from "./routing";
import type messages from "../../messages/en.json";

// Types next-intl's hooks from our config (spec 0005 AC-7, AC-8): message keys come from
// the reference locale `en`, locales from the routing config. This file only holds types and is
// never imported at runtime.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
