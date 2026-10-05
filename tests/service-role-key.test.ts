// Spec 0035 AC-23: the service role client bypasses row level security, so only the Telegram webhook may import it.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [full] : [];
  });
}

describe("spec 0035: the service role key", () => {
  it("AC-23: only the Telegram webhook route imports the service client, and only server code names the key", () => {
    const root = path.resolve(__dirname, "..");
    const importers: string[] = [];
    const namers: string[] = [];
    for (const file of sourceFiles(path.join(root, "src"))) {
      const text = fs.readFileSync(file, "utf8");
      const name = path.relative(root, file).replaceAll("\\", "/");
      if (/supabase\/service["']|from ["']\.\/service["']/.test(text) && !name.endsWith(".test.ts")) importers.push(name);
      if (text.includes("SUPABASE_SERVICE_ROLE_KEY") && !name.endsWith(".test.ts")) namers.push(name);
    }
    expect(importers).toEqual(["src/app/api/telegram/route.ts"]);
    expect(namers.sort()).toEqual(["src/app/api/telegram/route.ts", "src/lib/supabase/service.ts"]);
  });
});
