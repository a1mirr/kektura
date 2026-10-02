import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { isTestEmail, TEST_PASSWORD, testLoginEnabled } from "@/lib/test-login";

// Dummy sign-in of the test server (spec 0006): any email, fixed password; the account is created on
// first use (the local Supabase doesn't confirm emails). 404 unless the test login is enabled.
export async function POST(request: Request) {
  if (!testLoginEnabled()) return new NextResponse(null, { status: 404 });

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const requested = form.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const next = form.get("next")?.toString() || "/dashboard";
  const to = (path: string) => NextResponse.redirect(`${requestOrigin(request)}/${locale}${path}`, 303);
  if (!isTestEmail(email)) return to("?error=auth");

  const supabase = await createClient();
  const credentials = { email, password: TEST_PASSWORD };
  let { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) ({ error } = await supabase.auth.signUp(credentials));
  return to(error ? "?error=auth" : (next.startsWith("/") ? next : "/" + next));
}
