import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // The locale comes from the query string: only ever put a known one into the redirect path.
  const requested = searchParams.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/${locale}/dashboard`);
  }
  return NextResponse.redirect(`${origin}/${locale}?error=auth`);
}
