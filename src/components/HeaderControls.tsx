import { flagOn } from "@/lib/feature-flags-server";
import { createClient } from "@/lib/supabase/server";
import AccountMenu from "./AccountMenu";
import LocaleSwitcher from "./LocaleSwitcher";

// The right side of the header strip (spec 0014 AC-20): the language switcher for everybody, and the account menu for a
// signed-in visitor. It reads the session with `getUser()` (never `getClaims()`, the gotcha in CLAUDE.md) and the `friends`
// flag per request, which makes every page of the locale layout render per request (AC-28). A visitor without a session
// asks neither Supabase nor the flags table.
export default async function HeaderControls() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const friends = user ? await flagOn("friends") : false;

  return (
    <>
      <LocaleSwitcher />
      {user && <AccountMenu friends={friends} />}
    </>
  );
}
