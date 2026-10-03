import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { friendsEnabled } from "@/lib/friends-flag";
import { getFriendProgress, getFriends } from "@/lib/friends";
import { originFromHeaders } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { approveRequest, ignoreRequest, regenerateInvite, removeFriend, setDisplayName, setSharing } from "./actions";

// The `?error=` values the invite page sends back: anything else in the URL is ignored, never shown.
const ERRORS = ["invalid_token", "own_token", "already_friends", "already_pending", "unauthorized", "failed"] as const;

export default async function FriendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (!friendsEnabled()) notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { error } = await searchParams;
  const errorKey = ERRORS.find((e) => e === error);

  const t = await getTranslations("friends");
  const tDash = await getTranslations("dashboard");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/", locale });

  const [friends, { data: token }, { data: profile }] = await Promise.all([
    getFriends(supabase),
    supabase.rpc("get_my_invite_token"),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);

  const origin = originFromHeaders(await headers(), "http://localhost:3000");
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
      {errorKey && <div className="rounded-lg bg-red-50 p-4 text-red-700">{t(`error_${errorKey}`)}</div>}

      <section className="space-y-4">
        <form
          className="flex gap-2"
          action={async (data: FormData) => {
            "use server";
            await setDisplayName(String(data.get("name") ?? ""));
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-sm text-stone-600">
            {t("displayNameLabel")}
            <input
              name="name"
              required
              maxLength={40}
              defaultValue={profile?.display_name ?? ""}
              className="rounded border p-2 text-base text-stone-900"
            />
          </label>
          <button className="self-end rounded bg-stone-200 px-4 py-2">{t("displayNameSave")}</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("inviteTitle")}</h2>
        <div className="flex gap-2">
          <input readOnly value={inviteLink} className="flex-1 rounded border p-2" />
          <form
            action={async () => {
              "use server";
              await regenerateInvite();
            }}
          >
            <button className="rounded bg-stone-200 px-4 py-2">{t("regenerate")}</button>
          </form>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("pendingTitle")}</h2>
          <ul className="space-y-2">
            {pending.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded border p-2">
                <span>{f.displayName}</span>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await approveRequest(f.id);
                    }}
                  >
                    <button className="rounded bg-green-500 px-3 py-1 text-white">{t("approve")}</button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await ignoreRequest(f.id);
                    }}
                  >
                    <button className="rounded bg-red-500 px-3 py-1 text-white">{t("ignore")}</button>
                  </form>
                </div>
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
                <div className="flex items-center justify-between">
                  {f.friendIsSharing ? (
                    <Link href={`/friends/${f.id}`} className="font-bold text-blue-600 hover:underline">
                      {f.displayName}
                    </Link>
                  ) : (
                    <span className="font-bold">{f.displayName}</span>
                  )}
                  <form
                    action={async () => {
                      "use server";
                      await removeFriend(f.id);
                    }}
                  >
                    <button className="text-sm text-red-600">{t("remove")}</button>
                  </form>
                </div>
                <div className="text-sm text-stone-600">
                  {f.progress
                    ? t("summary", {
                        stamps: f.progress.stampedKeys.size,
                        total: f.progress.places.length,
                        km: tDash("kmValue", { km: format.number(f.progress.summary.doneKm) }),
                        stages: f.progress.completedStages,
                      })
                    : t("notSharing")}
                </div>
                <form
                  action={async () => {
                    "use server";
                    await setSharing(f.id, !f.isSharing);
                  }}
                  className="flex items-center gap-2"
                >
                  <button className="rounded bg-stone-200 px-2 py-1 text-sm">
                    {f.isSharing ? t("stopSharing") : t("startSharing")}
                  </button>
                  <span className="text-sm text-stone-500">{f.isSharing ? t("isSharing") : t("notSharing")}</span>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
