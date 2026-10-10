import path from "node:path";
import type { NextConfig } from "next";
import { routing } from "./src/i18n/routing";

const requestConfig = "./src/i18n/request.ts";

const nextConfig: NextConfig = {
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
