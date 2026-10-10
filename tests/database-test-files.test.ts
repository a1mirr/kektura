import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const testFiles = fs.readdirSync(new URL("../tests/", import.meta.url)).filter((name) => name.endsWith(".test.ts"));

const aboutTheRule = ["database-test-files.test.ts", "local-db-helper.test.ts"];

const touchesDatabase = (text: string) =>
  /e2e\/local-db/.test(text) || /execFileSync\(\s*"docker"/.test(text) || /\bhasDatabase\b/.test(text);

const databaseFiles = testFiles.filter((name) => !aboutTheRule.includes(name) && touchesDatabase(read(`tests/${name}`)));

describe("spec 0007: the database test files", () => {
  it("AC-12: the rule finds the database tests (the files CI's database step runs)", () => {
    expect(databaseFiles).toEqual(
      expect.arrayContaining([
        "database-rules.test.ts",
        "feature-flags-database.test.ts",
        "flag-admin-database.test.ts",
        "friends-migration.test.ts",
        "retired-stamps-database.test.ts",
        "seed-cleanup.test.ts",
        "stamp-dates-database.test.ts",
      ]),
    );
  });

  describe.each(databaseFiles)("%s", (name) => {
    const text = read(`tests/${name}`);

    it("AC-12: imports requireDatabase from the helper and calls it in tests", () => {
      expect(text).toMatch(/import \{[^}]*\brequireDatabase\b[^}]*\} from "\.\.\/e2e\/local-db"/);
      expect(text).toMatch(/requireDatabase\(ctx\b/);
    });

    it("AC-12: has no skip and no reachability check of its own", () => {
      expect(text).not.toMatch(/\bctx\.skip\(|\bcontext\.skip\(|\bit\.skip\b|\bdescribe\.skip\b|\.skipIf\(|\bhasDatabase\b/);
      expect(text).not.toMatch(/REQUIRE_LOCAL_DB\s*[=!]|process\.env\.REQUIRE_LOCAL_DB/);
    });

    it("AC-13: is run by CI's database step", () => {
      const ci = read(".github/workflows/ci.yml");
      const run = ci.split("\n").find((line) => line.includes("npx vitest run") && line.includes("tests/")) ?? "";
      expect(run.split(/\s+/)).toContain(`tests/${name}`);
    });
  });
});
