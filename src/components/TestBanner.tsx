import { getTranslations } from "next-intl/server";

export default async function TestBanner() {
  const t = await getTranslations("app");

  return (
    <div role="status" className="bg-amber-400 px-4 py-1 text-center text-sm font-medium text-amber-950">
      {t("testBanner")}
    </div>
  );
}
