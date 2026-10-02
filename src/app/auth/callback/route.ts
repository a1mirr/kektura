import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  console.log("[AUTH CALLBACK] request.url:", request.url);
  console.log("[AUTH CALLBACK] headers.host:", request.headers.get("host"));
  const { searchParams, origin } = new URL(request.url);
  console.log("[AUTH CALLBACK] origin:", origin);
  const code = searchParams.get("code");
  // The locale comes from the query string: only ever put a known one into the redirect path.
  const requested = searchParams.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log("[AUTH CALLBACK] Redirecting to:", `${origin}/${locale}/dashboard`);
      return NextResponse.redirect(`${origin}/${locale}/dashboard`);
    } else {
      console.error("[AUTH CALLBACK] exchangeCodeForSession error:", error);
    }
  }
  return NextResponse.redirect(`${origin}/${locale}?error=auth`);
}
