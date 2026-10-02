import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isFriendsEnabled, sendRequest } from "../../actions";
import SignInButton from "@/components/SignInButton";
import TestLoginForm from "@/components/TestLoginForm";
import { testLoginEnabled } from "@/lib/test-login";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  if (!(await isFriendsEnabled())) notFound();

  const { locale, token } = await params;
  const t = await getTranslations("friends");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: inviterInfo } = await supabase.rpc('get_inviter_info', { token });
  if (!inviterInfo || inviterInfo.length === 0) return <div className="max-w-md mx-auto mt-16 p-6 text-center border rounded-xl space-y-6"><h1 className="text-2xl font-bold">{t("invalidToken")}</h1></div>;
  const { inviter_id: inviterId, display_name: inviterName } = inviterInfo[0];

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center border rounded-xl space-y-6">
        <h1 className="text-2xl font-bold">{t("inviteFrom", { name: inviterName })}</h1>
        <div className="flex flex-col items-center gap-4">
          <SignInButton next={'/friends/invite/' + token} />
          {testLoginEnabled() && <TestLoginForm locale={locale} next={'/friends/invite/' + token} />}
        </div>
      </div>
    );
  }

  if (user.id === inviterId) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center border rounded-xl space-y-6">
        <h1 className="text-2xl font-bold">{t("ownLink")}</h1>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6 text-center border rounded-xl space-y-6">
      <h1 className="text-2xl font-bold">{t("inviteFrom", { name: inviterName })}</h1>
      <form action={async () => {
        "use server";
        const res = await sendRequest(token);
        if (res.ok) {
          redirect('/' + locale + '/friends');
        } else {
          redirect('/' + locale + '/friends?error=' + res.reason);
        }
      }}>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">
          {t("sendRequest")}
        </button>
      </form>
    </div>
  );
}

