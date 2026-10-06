import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { CHANGELOG, type ChangeKind } from "@/content/changelog";
import PageShell from "@/components/PageShell";

// See spec 0018. The entries are data in src/content/changelog.ts.

type Props = { params: Promise<{ locale: string }> };

const BADGE: Record<ChangeKind, string> = {
  new: "bg-blue-100 text-blue-800",
  improved: "bg-stone-200 text-stone-700",
  fixed: "bg-amber-100 text-amber-800",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "changelog" });
  return { title: t("title"), description: t("intro") };
}

export default async function ChangelogPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("changelog");
  const format = await getFormatter();

  return (
    <PageShell variant="reading">
      <h1 className="mb-4 text-2xl font-bold text-blue-700">{t("title")}</h1>
      <p className="text-stone-700">{t("intro")}</p>

      <ol className="mt-8 space-y-6">
        {CHANGELOG.map((entry) => (
          <li key={entry.date}>
            <article aria-labelledby={`log-${entry.date}`} className="rounded-lg bg-white p-4 shadow-sm">
              {/* Plain dates are shown in UTC so they can't shift a day with the visitor's time zone. */}
              <time dateTime={entry.date} className="text-sm text-stone-500">
                {format.dateTime(new Date(`${entry.date}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" })}
              </time>
              <h2 id={`log-${entry.date}`} className="mt-1 font-semibold">
                {entry.title[locale]}
              </h2>
              <ul className="mt-3 space-y-2 text-stone-700">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span
                      className={`w-28 shrink-0 rounded px-2 py-0.5 text-center text-xs font-medium ${BADGE[change.kind]}`}
                    >
                      {t(`kind.${change.kind}`)}
                    </span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{change.text[locale]}</span>
                  </li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
