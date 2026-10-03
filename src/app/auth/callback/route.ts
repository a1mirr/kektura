import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Behind the proxy request.url says localhost: redirect to the address the user is on (spec 0020).
  const origin = requestOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // The locale comes from the query string: only ever put a known one into the redirect path.
  const requested = searchParams.get("locale");
  // Where to land after sign-in (a path without locale, e.g. an invite link); only ever appended to our own origin.
  const next = searchParams.get("next") || "/dashboard";
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/${locale}${next.startsWith("/") ? next : `/${next}`}`);
  }
  return NextResponse.redirect(`${origin}/${locale}?error=auth`);
}
