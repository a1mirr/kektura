import createIntlMiddleware from "next-intl/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // Refresh the Supabase session before anything else. A refreshed token pair has to reach the
  // Server Components of this very request (via request cookies) and the browser (via the response);
  // otherwise the page would try to refresh again with an already-rotated refresh token.
  let refreshed: { name: string; value: string; options: CookieOptions }[] = [];
  let cacheHeaders: Record<string, string> = {};
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (list, headers) => {
            refreshed = list;
            cacheHeaders = headers;
          },
        },
      },
    );
    // Refreshes the session if the access token expired. Unlike getUser() it verifies the JWT locally
    // when the project uses asymmetric signing keys, so most requests skip the Auth server round trip.
    await supabase.auth.getClaims();
    refreshed.forEach(({ name, value }) => request.cookies.set(name, value));
  }

  const response = intlMiddleware(request);
  refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  // Everything except API routes, the OAuth callback, Next internals and files with an extension.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
