import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import FriendActionButton from "@/components/FriendActionButton";
import PageShell from "@/components/PageShell";
import SignInButton from "@/components/SignInButton";
import TestLoginForm from "@/components/TestLoginForm";
import { routing } from "@/i18n/routing";
import { flagOn } from "@/lib/feature-flags-server";
import { friendsPath } from "@/lib/friends-input";
import { createClient } from "@/lib/supabase/server";
import { testLoginEnabled } from "@/lib/test-login";
import { sendRequest } from "../../actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  if (!(await flagOn("friends"))) notFound();
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("friends");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out: through sign-in and back here. The link's owner and its validity are not revealed to someone who has
  // not signed in.
  if (!user) {
    const next = `/friends/invite/${token}`;
    return (
      <PageShell variant="card">
        <h1 className="text-2xl font-bold">{t("inviteSignIn")}</h1>
        <div className="flex flex-col items-center gap-4">
          <SignInButton next={next} />
          {testLoginEnabled() && <TestLoginForm locale={locale} next={next} />}
        </div>
      </PageShell>
    );
  }

  const { data: inviter } = await supabase.rpc("get_inviter_info", { token });
  if (!inviter || inviter.length === 0) {
    return (
      <PageShell variant="card">
        <h1 className="text-2xl font-bold">{t("invalidToken")}</h1>
      </PageShell>
    );
  }
  const { display_name: inviterName, is_own: isOwn } = inviter[0];

  if (isOwn) {
    return (
      <PageShell variant="card">
        <h1 className="text-2xl font-bold">{t("ownLink")}</h1>
      </PageShell>
    );
  }

  return (
    <PageShell variant="card">
      <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">{t("inviteFrom", { name: inviterName })}</h1>
      <form
        action={async () => {
          "use server";
          const res = await sendRequest(token);
          redirect(`/${locale}${friendsPath(res, "sent")}`);
        }}
      >
        <FriendActionButton tone="primary">{t("sendRequest")}</FriendActionButton>
      </form>
    </PageShell>
  );
}
