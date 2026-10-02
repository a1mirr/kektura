import path from "node:path";
import type { NextConfig } from "next";

// next-intl's createNextIntlPlugin pulls in the native @swc/core addon, which
// fails its cache-permission check on some Windows setups. It only wires the
// request config alias, so we do that by hand.
const requestConfig = "./src/i18n/request.ts";

const nextConfig: NextConfig = {
  // The test server (scripts/test-env.mjs) builds into .next-test, so it can run next to `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    resolveAlias: { "next-intl/config": requestConfig },
  },
  // Spec 0025 AC-2: the account page used to live at /settings. Temporary (307), so the address stays free
  // for real settings later.
  async redirects() {
    return [{ source: "/:locale(ru|en|hu)/settings", destination: "/:locale/account", permanent: false }];
  },
  webpack(config) {
    config.resolve.alias["next-intl/config"] = path.resolve(
      __dirname,
      requestConfig,
    );
    return config;
  },
};

export default nextConfig;
