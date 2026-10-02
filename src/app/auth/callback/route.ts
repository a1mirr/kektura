import { NextResponse } from 'next/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { requestOrigin } from '@/lib/origin';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const requested = searchParams.get('locale');
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const next = searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/${locale}${next.startsWith('/') ? next : '/' + next}`);
  }
  return NextResponse.redirect(`${origin}/${locale}?error=auth`);
}
