import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SignInButton from "@/components/SignInButton";
import TestLoginForm from "@/components/TestLoginForm";
import { routing } from "@/i18n/routing";
import { friendsOn } from "@/lib/friends-flag";
import { createClient } from "@/lib/supabase/server";
import { testLoginEnabled } from "@/lib/test-login";
import { sendRequest } from "../../actions";

const card = "mx-auto mt-16 max-w-md space-y-6 rounded-xl border p-6 text-center";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  if (!(await friendsOn())) notFound();
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("friends");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out (spec 0024 AC-3): through sign-in and back here. The link's owner and its validity are not
  // revealed to someone who has not signed in.
  if (!user) {
    const next = `/friends/invite/${token}`;
    return (
      <div className={card}>
        <h1 className="text-2xl font-bold">{t("inviteSignIn")}</h1>
        <div className="flex flex-col items-center gap-4">
          <SignInButton next={next} />
          {testLoginEnabled() && <TestLoginForm locale={locale} next={next} />}
        </div>
      </div>
    );
  }

  const { data: inviter } = await supabase.rpc("get_inviter_info", { token });
  if (!inviter || inviter.length === 0) {
    return (
      <div className={card}>
        <h1 className="text-2xl font-bold">{t("invalidToken")}</h1>
      </div>
    );
  }
  const { display_name: inviterName, is_own: isOwn } = inviter[0];

  if (isOwn) {
    return (
      <div className={card}>
        <h1 className="text-2xl font-bold">{t("ownLink")}</h1>
      </div>
    );
  }

  return (
    <div className={card}>
      <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">{t("inviteFrom", { name: inviterName })}</h1>
      <form
        action={async () => {
          "use server";
          const res = await sendRequest(token);
          redirect(`/${locale}/friends?${res.ok ? "sent=1" : `error=${res.reason}`}`);
        }}
      >
        <button className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700">
          {t("sendRequest")}
        </button>
      </form>
    </div>
  );
}
