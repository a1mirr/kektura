import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-auto border-t border-stone-200 bg-white py-6">
      <div className="mx-auto max-w-3xl px-6 flex flex-wrap gap-4 text-sm text-stone-500 justify-between items-center">
        <div className="flex gap-4">
          <Link href="/about" className="hover:text-stone-900 hover:underline">{t("about")}</Link>
          <Link href="/changelog" className="hover:text-stone-900 hover:underline">{t("changelog")}</Link>
          <Link href="/links" className="hover:text-stone-900 hover:underline">{t("usefulLinks")}</Link>
          <Link href="/feedback" className="hover:text-stone-900 hover:underline">{t("feedback")}</Link>
        </div>
        <div>
          <Link href="/settings" className="hover:text-stone-900 hover:underline">{t("settings")}</Link>
        </div>
      </div>
    </footer>
  );
}
