import { flagOn } from "@/lib/feature-flags-server";
import { createClient } from "@/lib/supabase/server";
import AccountMenu from "./AccountMenu";
import LocaleSwitcher from "./LocaleSwitcher";

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
