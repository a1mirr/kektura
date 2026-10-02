import { getLocale, getTranslations } from "next-intl/server";

// A plain form (no client JS): see src/app/auth/sign-out/route.ts.
export default async function SignOutButton() {
  const t = await getTranslations("account");
  const locale = await getLocale();

  return (
    <form action="/auth/sign-out" method="post">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="text-sm text-stone-600 hover:underline">
        {t("signOut")}
      </button>
    </form>
  );
}
