import { getLocale, getTranslations } from "next-intl/server";

export default async function SignOutButton() {
  const t = await getTranslations("account");
  const locale = await getLocale();

  return (
    <form action="/auth/sign-out" method="post">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="-mr-3 min-h-11 px-3 text-sm text-stone-600 hover:underline">
        {t("signOut")}
      </button>
    </form>
  );
}
