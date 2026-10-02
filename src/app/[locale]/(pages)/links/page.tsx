import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function LinksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setRequestLocale(locale as any);
  const t = await getTranslations("links");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-2xl font-bold text-blue-700">{t("title")}</h1>
      <ul className="list-disc pl-5 text-stone-700">
        <li>
          <a href="https://kektura.hu" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            {t("official")}
          </a>
        </li>
      </ul>
    </main>
  );
}
