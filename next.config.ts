import path from "node:path";
import type { NextConfig } from "next";
import { routing } from "./src/i18n/routing";

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
  async redirects() {
    return [{ source: `/:locale(${routing.locales.join("|")})/settings`, destination: "/:locale/account", permanent: false }];
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
