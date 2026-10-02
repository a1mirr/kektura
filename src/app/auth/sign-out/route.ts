import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

// Sign out from a plain form POST (spec 0005 AC-6): works before the page has hydrated, revokes the
// session at Supabase from the server (a browser-side logout request can be cut off by the
// navigation that follows it) and clears the session cookies.
export async function POST(request: Request) {
  const requested = (await request.formData()).get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;
  return NextResponse.redirect(`${origin}/${locale}`, 303);
}
