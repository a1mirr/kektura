import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import FlashMessage from "@/components/FlashMessage";
import FriendActionButton from "@/components/FriendActionButton";
import FriendActionGroup from "@/components/FriendActionGroup";
import FriendConfirm from "@/components/FriendConfirm";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { flagOn } from "@/lib/feature-flags-server";
import { getFriendProgress, getFriends } from "@/lib/friends";
import { FRIEND_NOTICES, friendsPath, REQUEST_REFUSALS, type FriendNotice } from "@/lib/friends-input";
import { originFromHeaders } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { approveRequest, ignoreRequest, regenerateInvite, removeFriend, setDisplayName, setSharing } from "./actions";

// The `?error=` and `?ok=` values the page itself sends back (a refused request, an action that failed or went
// through): anything else in the URL is ignored, never shown.
const ERRORS = [...REQUEST_REFUSALS, "unauthorized", "failed"] as const;

// Every action ends by reloading the page: the answer to it is in the URL (`?ok=`, `?error=`), which also clears the
// previous one.
function done(locale: (typeof routing.locales)[number], result: ActionResult, notice: FriendNotice) {
  redirect({ href: friendsPath(result, notice), locale });
}

export default async function FriendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  if (!(await flagOn("friends"))) notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { error, ok } = await searchParams;
  const errorKey = ERRORS.find((e) => e === error);
  const noticeKey = FRIEND_NOTICES.find((n) => n === ok);

  const t = await getTranslations("friends");
  const tDash = await getTranslations("dashboard");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/", locale });

  const [friends, { data: token }, { data: profile }] = await Promise.all([
    getFriends(supabase, user.id),
    supabase.rpc("get_my_invite_token"),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);

  const origin = originFromHeaders(await headers(), "http://localhost");
  const inviteLink = token ? `${origin}/${locale}/friends/invite/${token}` : "";

  const pending = friends.filter((f) => f.status === "pending" && !f.isRequester);
  const accepted = await Promise.all(
    friends
      .filter((f) => f.status === "accepted")
      .map(async (f) => ({ ...f, progress: f.friendIsSharing ? await getFriendProgress(f) : null })),
  );

  return (
    <div className="mx-auto max-w-xl space-y-8 p-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {errorKey && <FlashMessage kind="error">{t(`error_${errorKey}`)}</FlashMessage>}
      {!errorKey && noticeKey && <FlashMessage kind="ok">{t(`ok_${noticeKey}`)}</FlashMessage>}

      <section className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          action={async (data: FormData) => {
            "use server";
            done(locale, await setDisplayName(String(data.get("name") ?? "")), "name");
          }}
        >
          <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1 text-sm text-stone-600">
            {t("displayNameLabel")}
            <input
              name="name"
              required
              maxLength={40}
              defaultValue={profile?.display_name ?? ""}
              className="min-h-11 w-full rounded border p-2 text-base text-stone-900"
            />
          </label>
          <FriendActionButton>{t("displayNameSave")}</FriendActionButton>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("inviteTitle")}</h2>
        <FriendActionGroup className="flex flex-wrap items-start gap-2">
          <input readOnly value={inviteLink} aria-label={t("inviteTitle")} className="min-h-11 min-w-0 flex-1 basis-48 rounded border p-2" />
          <FriendConfirm label={t("regenerate")} question={t("regenerateConfirm")} cancelLabel={t("cancel")} tone="neutral">
            <form
              action={async () => {
                "use server";
                done(locale, await regenerateInvite(), "regenerated");
              }}
            >
              <FriendActionButton tone="danger">{t("regenerateYes")}</FriendActionButton>
            </form>
          </FriendConfirm>
        </FriendActionGroup>
      </section>

      {pending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("pendingTitle")}</h2>
          <ul className="space-y-2">
            {pending.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                <span className="min-w-0 [overflow-wrap:anywhere]">{f.displayName}</span>
                <FriendActionGroup className="flex shrink-0 flex-wrap gap-2">
                  <form
                    action={async () => {
                      "use server";
                      done(locale, await approveRequest(f.id), "approved");
                    }}
                  >
                    <FriendActionButton tone="approve">{t("approve")}</FriendActionButton>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      done(locale, await ignoreRequest(f.id), "ignored");
                    }}
                  >
                    <FriendActionButton tone="danger">{t("ignore")}</FriendActionButton>
                  </form>
                </FriendActionGroup>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("acceptedTitle")}</h2>
        {accepted.length === 0 ? (
          <p className="text-stone-500">{t("noFriends")}</p>
        ) : (
          <ul className="space-y-4">
            {accepted.map((f) => (
              <li key={f.id} className="space-y-2 rounded border p-4">
                {f.friendIsSharing ? (
                  <Link href={`/friends/${f.id}`} className="block min-w-0 [overflow-wrap:anywhere] font-bold text-blue-600 hover:underline">
                    {f.displayName}
                  </Link>
                ) : (
                  <span className="block min-w-0 [overflow-wrap:anywhere] font-bold">{f.displayName}</span>
                )}
                <div className="text-sm text-stone-600">
                  {f.progress
                    ? t("summary", {
                        stamps: f.progress.stampedKeys.size,
                        total: f.progress.places.length,
                        km: tDash("kmValue", { km: format.number(f.progress.summary.doneKm) }),
                        stages: f.progress.completedStages,
                      })
                    : t("friendNotSharing")}
                </div>
                <FriendActionGroup className="flex flex-wrap items-center gap-2">
                  <form
                    action={async () => {
                      "use server";
                      done(locale, await setSharing(f.id, !f.isSharing), f.isSharing ? "sharing_off" : "sharing_on");
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <FriendActionButton>{f.isSharing ? t("stopSharing") : t("startSharing")}</FriendActionButton>
                    <span className="text-sm text-stone-500">{f.isSharing ? t("isSharing") : t("notSharing")}</span>
                  </form>
                  <FriendConfirm label={t("remove")} question={t("removeConfirm", { name: f.displayName ?? "" })} cancelLabel={t("cancel")}>
                    <form
                      action={async () => {
                        "use server";
                        done(locale, await removeFriend(f.id), "removed");
                      }}
                    >
                      <FriendActionButton tone="danger">{t("removeYes")}</FriendActionButton>
                    </form>
                  </FriendConfirm>
                </FriendActionGroup>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
