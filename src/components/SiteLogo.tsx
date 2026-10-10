import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { pageWidth } from "./PageShell";

// Rendered once by the locale layout and by the 404 page, which has no locale layout and gives no children: a page
// never draws its own copy.
export default async function SiteLogo({ locale, children }: { locale: Locale; children?: ReactNode }) {
  const t = await getTranslations({ locale, namespace: "app" });

  return (
    <header className={`${pageWidth} flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-4`}>
      <Link
        href={`/${locale}`}
        aria-label={t("home")}
        className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-2 font-bold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <Image src="/logo.svg" alt="" width={32} height={32} unoptimized />
        {t("name")}
      </Link>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </header>
  );
}
