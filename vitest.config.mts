import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    // next-intl's ESM imports `next/server` without an extension, which only a bundler resolves.
    server: { deps: { inline: ["next-intl"] } },
  },
});
