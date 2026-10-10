import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { LINK_GROUPS } from "@/content/links";
import PageShell from "@/components/PageShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "links" });
  return { title: t("title"), description: t("intro") };
}

export default async function LinksPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("links");

  return (
    <PageShell variant="reading">
      <h1 className="mb-4 text-2xl font-bold text-blue-700">{t("title")}</h1>
      <p className="text-stone-700">{t("intro")}</p>

      {LINK_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`links-${group.id}`} className="mt-8">
          <h2 id={`links-${group.id}`} className="mb-2 font-semibold">
            {t(`groups.${group.id}`)}
          </h2>
          <ul className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
            {group.links.map((link) => (
              <li key={link.id} className="text-stone-700">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {link.name}
                </a>
                <span className="block text-sm text-stone-600">{t(`items.${link.id}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  );
}
