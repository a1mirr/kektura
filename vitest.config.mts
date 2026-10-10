import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Logic tests run in Node; component tests opt into a DOM with a `// @vitest-environment jsdom` comment at the top of
// the file.
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
