import Image from "next/image";
import { useTranslations } from "next-intl";
import { SCREENSHOT_SIZE, SCREENSHOTS, screenshotPath } from "@/lib/screenshots";

// The landing page's gallery (spec 0038): what the app looks like, for a visitor who has not signed in yet. Plain images
// in the English interface, each in a <figure> with a caption and an alternative text in the visitor's language. No
// client JavaScript. The images carry their size (no layout shift), load lazily and are resized by next/image to what
// is shown: one column on a phone, three from 768 px.
export default function Screenshots() {
  const t = useTranslations("home.screenshots");

  return (
    <section aria-labelledby="screenshots-heading" className="w-full">
      <h2 id="screenshots-heading" className="text-2xl font-semibold text-stone-800">
        {t("heading")}
      </h2>
      <p className="mt-1 text-sm text-stone-500">{t("note")}</p>
      <ul className="mx-auto mt-6 grid max-w-sm list-none gap-10 p-0 md:max-w-none md:grid-cols-3 md:gap-8">
        {SCREENSHOTS.map((name) => (
          <li key={name}>
            <figure>
              <Image
                src={screenshotPath(name)}
                alt={t(`${name}Alt`)}
                width={SCREENSHOT_SIZE.width}
                height={SCREENSHOT_SIZE.height}
                sizes="(min-width: 768px) 304px, (min-width: 417px) 384px, 92vw"
                className="h-auto w-full rounded-xl border border-stone-200 shadow-sm"
              />
              <figcaption className="mt-3 text-sm text-stone-600">{t(`${name}Caption`)}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
