import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const requested = (await request.formData()).get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${requestOrigin(request)}/${locale}`, 303);
}
