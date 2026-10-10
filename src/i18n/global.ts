import type { routing } from "./routing";
import type messages from "../../messages/en.json";

// Message keys come from the reference locale `en`, locales from the routing config. This file only holds types and
// is never imported at runtime.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
