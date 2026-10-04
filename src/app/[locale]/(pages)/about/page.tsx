import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { friendsOn } from "@/lib/friends-flag";
import { TRAIL_FACTS } from "@/lib/trail-facts";

// See specs/0015-about-page.md. Everything the page says has to be true of the app today.

type Props = { params: Promise<{ locale: string }> };

// Each source's name is a proper noun; only the description is translated.
const SOURCES = [
  { name: "kektura.hu (MTSZ)", href: "https://www.kektura.hu/okt-szakaszok", text: "sourceMtsz" },
  { name: "heyjoe.hu", href: "https://heyjoe.hu", text: "sourceHeyjoe" },
  { name: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright", text: "sourceOsm" },
  { name: "etteremhet.hu", href: "https://www.etteremhet.hu", text: "sourceEtteremhet" },
] as const;

const link = "text-blue-600 hover:underline";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("title"), description: t("description") };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const format = await getFormatter();
  const showFriends = await friendsOn();

  const facts = [
    { label: t("factsStages"), value: format.number(TRAIL_FACTS.stages) },
    { label: t("factsPlaces"), value: format.number(TRAIL_FACTS.places) },
    { label: t("factsKm"), value: format.number(TRAIL_FACTS.km) },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-2xl font-bold text-blue-700">{t("title")}</h1>
      <p className="text-stone-700">{t("description")}</p>

      <section aria-labelledby="about-facts" className="mt-8">
        <h2 id="about-facts" className="mb-2 font-semibold">
          {t("factsTitle")}
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="rounded-lg bg-white p-4 shadow-sm">
              <dt className="text-sm text-stone-500">{f.label}</dt>
              <dd className="text-2xl font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="about-how" className="mt-8">
        <h2 id="about-how" className="mb-2 font-semibold">
          {t("howTitle")}
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-stone-700">
          <li>{t("how1")}</li>
          <li>{t("how2")}</li>
          <li>{t("how3")}</li>
          <li>{t("how4")}</li>
        </ol>
      </section>

      <section aria-labelledby="about-sources" className="mt-8">
        <h2 id="about-sources" className="mb-2 font-semibold">
          {t("sourcesTitle")}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-stone-700">
          {SOURCES.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className={link}>
                {s.name}
              </a>
              : {t(s.text)}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-stone-500">{t("independent")}</p>
      </section>

      <section aria-labelledby="about-data" className="mt-8">
        <h2 id="about-data" className="mb-2 font-semibold">
          {t("dataTitle")}
        </h2>
        <div className="space-y-2 text-stone-700">
          <p>{t("data1")}</p>
          <p>{t("data2")}</p>
          <p>
            {t.rich("data3", {
              account: (chunks) => (
                <Link href="/account" className={link}>
                  {chunks}
                </Link>
              ),
            })}
          </p>
          {showFriends && <p>{t("data4")}</p>}
        </div>
      </section>

      <section aria-labelledby="about-contact" className="mt-8">
        <h2 id="about-contact" className="mb-2 font-semibold">
          {t("contactTitle")}
        </h2>
        <p className="text-stone-700">
          {t.rich("contactText", {
            feedback: (chunks) => (
              <Link href="/feedback" className={link}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>
    </main>
  );
}
