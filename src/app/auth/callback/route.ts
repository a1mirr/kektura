import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { landingPath } from "@/lib/landing-path";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Behind the proxy request.url says localhost: redirect to the address the user is on.
  const origin = requestOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // The locale comes from the query string: only ever put a known one into the redirect path.
  const requested = searchParams.get("locale");
  const next = landingPath(searchParams.get("next"));
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/${locale}${next}`);
  }
  return NextResponse.redirect(`${origin}/${locale}?error=auth`);
}
