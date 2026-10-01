import path from "node:path";
import type { NextConfig } from "next";

// next-intl's createNextIntlPlugin pulls in the native @swc/core addon, which
// fails its cache-permission check on some Windows setups. It only wires the
// request config alias, so we do that by hand.
const requestConfig = "./src/i18n/request.ts";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: { "next-intl/config": requestConfig },
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
