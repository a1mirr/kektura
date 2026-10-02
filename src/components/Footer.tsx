import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Links to the pages anyone can open (spec 0014 AC-1). The account page is reached from the
// dashboard header instead: a footer link would lead signed-out visitors nowhere.
const LINKS = [
  { href: "/about", label: "about" },
  { href: "/changelog", label: "changelog" },
  { href: "/links", label: "usefulLinks" },
  { href: "/feedback", label: "feedback" },
] as const;

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-auto border-t border-stone-200 bg-white py-6">
      <nav className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 px-6 text-sm text-stone-500">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-stone-900 hover:underline">
            {t(link.label)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
