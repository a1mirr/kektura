// Spec 0026 AC-4, AC-6, AC-13: the migration script, against a fake psql that behaves like the record table.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { baselineFiles, migrationFiles, pendingMigrations, redact } from "../scripts/lib/deploy.mjs";
import { cli, createPsql, migrate, Problem } from "../scripts/migrate-production.mjs";

const URL_WITH_SECRET = "postgresql://postgres.abcd:p%40ss%2Fword@aws-0-eu.pooler.supabase.com:5432/postgres";

const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });

// A database that knows the record table and the files it was asked to apply.
function fakeDb({ table = true, applied = [] as string[], failing = [] as string[] } = {}) {
  const db = { table, applied: new Set(applied) };
  const calls: string[][] = [];
  const psql = (args: string[]) => {
    calls.push(args);
    const sql = args[args.indexOf("-c") + 1] ?? "";
    if (sql.includes("to_regclass")) return ok(db.table ? "t\n" : "f\n");
    if (sql.startsWith("select file_name")) return ok([...db.applied].sort().join("\n"));
    if (args.includes("-f")) {
      const name = args[args.indexOf("-f") + 1].split(/[\\/]/).pop()!;
      if (failing.includes(name)) return { status: 3, stdout: "", stderr: `ERROR: boom in ${name} (connection ${URL_WITH_SECRET})` };
      db.applied.add(/values \('([^']+)'\)/.exec(sql)![1]);
      return ok();
    }
    if (sql.includes("create table if not exists")) {
      db.table = true;
      for (const match of sql.matchAll(/\('([^']+)'\)/g)) db.applied.add(match[1]);
      return ok();
    }
    throw new Error(`unexpected psql ${args.join(" ")}`);
  };
  return { db, calls, psql };
}

const FILES = ["0001_init.sql", "0002_more.sql", "0008_pages.sql", "0024_friends.sql", "notes.txt", "README.md"];
const run = (options: Partial<Parameters<typeof migrate>[0]> & { psql: Parameters<typeof migrate>[0]["psql"] }) => {
  const log: string[] = [];
  const result = migrate({ dir: "supabase/migrations", names: FILES, url: URL_WITH_SECRET, log: (line) => log.push(line), ...options });
  return { result, log };
};
const writes = (calls: string[][]) => calls.filter((args) => args.includes("-f") || args.some((a) => a.includes("create table")));

describe("spec 0026: migrations", () => {
  describe("AC-4: applied in name order, each in its own transaction, recorded with it", () => {
    it("applies the missing files in order, each as one psql transaction with its own record insert", () => {
      const { db, calls, psql } = fakeDb({ applied: ["0001_init.sql", "0002_more.sql"] });
      const { result } = run({ psql });
      expect(result.applied).toEqual(["0008_pages.sql", "0024_friends.sql"]);
      const files = calls.filter((args) => args.includes("-f"));
      expect(files).toHaveLength(2);
      for (const args of files) {
        expect(args[0]).toBe("-1"); // --single-transaction: the file and the insert commit together or not at all
        expect(args.indexOf("-f")).toBeLessThan(args.indexOf("-c"));
      }
      expect(files[0].join(" ")).toMatch(/0008_pages\.sql.*values \('0008_pages\.sql'\)/);
      expect([...db.applied].sort()).toEqual(["0001_init.sql", "0002_more.sql", "0008_pages.sql", "0024_friends.sql"]);
    });

    it("applies nothing when nothing is missing, and ignores files that aren't migrations", () => {
      const { calls, psql } = fakeDb({ applied: ["0001_init.sql", "0002_more.sql", "0008_pages.sql", "0024_friends.sql"] });
      const { result, log } = run({ psql });
      expect(result.applied).toEqual([]);
      expect(writes(calls)).toEqual([]);
      expect(log).toContain("No migration is missing.");
    });

    it("stops at the first failing file: later ones are not tried and the failed one is not recorded", () => {
      const { db, calls, psql } = fakeDb({ applied: ["0001_init.sql"], failing: ["0002_more.sql"] });
      expect(() => run({ psql })).toThrow(/Migration 0002_more\.sql failed and was rolled back; nothing was recorded/);
      expect(calls.filter((args) => args.includes("-f"))).toHaveLength(1); // 0008 and 0024 were never tried
      expect(db.applied.has("0002_more.sql")).toBe(false);
    });

    it("never prints the connection string or the password, even when psql echoes them", () => {
      const { psql } = fakeDb({ applied: ["0001_init.sql"], failing: ["0002_more.sql"] });
      let message = "";
      try {
        run({ psql });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("boom in 0002_more.sql");
      expect(message).not.toContain("p%40ss%2Fword");
      expect(message).not.toContain("p@ss/word");
      expect(message).not.toContain(URL_WITH_SECRET);
      expect(message).toContain("***");
    });
  });

  describe("AC-6: a file that sorts before an applied one is still applied; a recorded one never again", () => {
    it("applies 0003 although 0024 is already recorded, in name order among the missing", () => {
      const names = ["0001_init.sql", "0003_late.sql", "0004_later.sql", "0024_friends.sql"];
      const { psql, calls } = fakeDb({ applied: ["0001_init.sql", "0024_friends.sql"] });
      const { result } = run({ psql, names });
      expect(result.applied).toEqual(["0003_late.sql", "0004_later.sql"]);
      expect(calls.filter((args) => args.includes("-f")).map((args) => args[args.indexOf("-f") + 1])).toEqual([
        path.join("supabase/migrations", "0003_late.sql"),
        path.join("supabase/migrations", "0004_later.sql"),
      ]);
    });

    it("pendingMigrations is by name and by record, never by content", () => {
      expect(pendingMigrations(["0001_a.sql", "0002_b.sql", "0003_c.sql"], new Set(["0002_b.sql"]))).toEqual(["0001_a.sql", "0003_c.sql"]);
    });

    it("migrationFiles keeps only NNNN_slug.sql, sorted", () => {
      expect(migrationFiles(["0024_friends.sql", "README.md", "0001_init.sql", "0003_Bad Name.sql", "123_x.sql", ".keep"])).toEqual(["0001_init.sql", "0024_friends.sql"]);
    });

    it("every file in supabase/migrations/ is named NNNN_slug.sql, so none is silently skipped", () => {
      const names = fs.readdirSync("supabase/migrations");
      expect(migrationFiles(names)).toEqual([...names].sort());
      expect(names.length).toBeGreaterThan(5);
    });
  });

  describe("AC-13: never guesses what production has", () => {
    it("refuses when there is no record table and no baseline, and changes nothing", () => {
      const { calls, psql } = fakeDb({ table: false });
      expect(() => run({ psql })).toThrow(Problem);
      expect(() => run({ psql })).toThrow(/never guesses[\s\S]*--baseline/);
      expect(writes(calls)).toEqual([]);
    });

    it("refuses an empty record table too", () => {
      const { psql } = fakeDb({ table: true, applied: [] });
      expect(() => run({ psql })).toThrow(/never guesses/);
    });

    it("with a baseline: creates the table, records that file and every one before it without running them", () => {
      const { db, calls, psql } = fakeDb({ table: false });
      const { result } = run({ psql, baseline: "0008_pages.sql" });
      expect(result.baselined).toEqual(["0001_init.sql", "0002_more.sql", "0008_pages.sql"]);
      expect([...db.applied].sort()).toEqual(["0001_init.sql", "0002_more.sql", "0008_pages.sql", "0024_friends.sql"]); // 0024 is applied after the baseline
      const create = calls.find((args) => args.some((a) => a.includes("create table")))!.join(" ");
      expect(create).toContain("enable row level security");
      expect(create).toContain("revoke all on public.applied_migrations from anon, authenticated");
      // the baseline files were not run: only 0024 was
      expect(calls.filter((args) => args.includes("-f"))).toHaveLength(1);
    });

    it("a baseline at the newest file records everything and runs nothing", () => {
      const { calls, psql } = fakeDb({ table: false });
      const { result } = run({ psql, baseline: "0024_friends.sql" });
      expect(result.applied).toEqual([]);
      expect(calls.filter((args) => args.includes("-f"))).toEqual([]);
    });

    it("refuses a baseline that is not a migration file", () => {
      const { calls, psql } = fakeDb({ table: false });
      expect(() => run({ psql, baseline: "0999_nope.sql" })).toThrow(Problem);
      expect(writes(calls)).toEqual([]);
      expect(() => baselineFiles(["0001_a.sql"], "0002_b.sql")).toThrow(/not a file/);
    });

    it("refuses a baseline once the table has records", () => {
      const { calls, psql } = fakeDb({ applied: ["0001_init.sql"] });
      expect(() => run({ psql, baseline: "0024_friends.sql" })).toThrow(/only for the first run/);
      expect(writes(calls)).toEqual([]);
    });
  });

  describe("AC-3: a dry run changes nothing", () => {
    it("lists what would be applied and makes no write", () => {
      const { calls, psql } = fakeDb({ applied: ["0001_init.sql"] });
      const { result, log } = run({ psql, dryRun: true });
      expect(result.applied).toEqual([]);
      expect(result.pending).toEqual(["0002_more.sql", "0008_pages.sql", "0024_friends.sql"]);
      expect(log).toEqual(["Would apply 0002_more.sql.", "Would apply 0008_pages.sql.", "Would apply 0024_friends.sql."]);
      expect(writes(calls)).toEqual([]);
    });

    it("with a baseline it says what would be recorded and does not create the table", () => {
      const { db, calls, psql } = fakeDb({ table: false });
      const { log } = run({ psql, dryRun: true, baseline: "0008_pages.sql" });
      expect(log[0]).toMatch(/3 files up to 0008_pages\.sql would be recorded/);
      expect(db.table).toBe(false);
      expect(writes(calls)).toEqual([]);
    });
  });

  describe("AC-14: the dry run says whether a migration is missing, for the backup step of the deploy", () => {
    const sql = migrationFiles(fs.readdirSync("supabase/migrations"));
    const call = (psql: Parameters<typeof migrate>[0]["psql"], argv: string[], extra: Record<string, string> = {}) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-"));
      const output = path.join(dir, "output");
      const summary = path.join(dir, "summary");
      const printed: string[] = [];
      cli({ argv, env: { SUPABASE_DB_URL: URL_WITH_SECRET, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, ...extra }, psql, print: (line: string) => printed.push(line) });
      const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
      return { output: read(output), summary: read(summary), printed };
    };

    it("AC-14: writes missing=true to $GITHUB_OUTPUT when a file is missing, and applies nothing in a dry run", () => {
      const { calls, psql } = fakeDb({ applied: sql.slice(0, -1) });
      const { output, printed } = call(psql, ["--dry-run"]);
      expect(output).toBe("missing=true\n");
      expect(printed.some((line) => line.startsWith("Would apply "))).toBe(true);
      expect(writes(calls)).toEqual([]);
    });

    it("AC-14: writes missing=false when every file is recorded", () => {
      const { psql } = fakeDb({ applied: sql });
      expect(call(psql, ["--dry-run"]).output).toBe("missing=false\n");
    });

    it("AC-14: with a baseline on an empty record table, only the files after the baseline count as missing", () => {
      const last = sql.at(-1)!;
      expect(call(fakeDb({ table: false }).psql, ["--dry-run", "--baseline", last]).output).toBe("missing=false\n");
      expect(call(fakeDb({ table: false }).psql, ["--dry-run", "--baseline", sql[0]]).output).toBe("missing=true\n");
    });

    it("AC-14: a run that fails (no record table, no baseline) throws and writes no output; the summary section is written", () => {
      const { psql } = fakeDb({ table: false });
      expect(() => call(psql, ["--dry-run"])).toThrow(Problem);
      const { summary } = call(fakeDb({ applied: sql }).psql, ["--dry-run"]);
      expect(summary).toContain("### Migrations (dry run)");
    });

    it("AC-14: without $GITHUB_OUTPUT it just runs", () => {
      const { psql } = fakeDb({ applied: sql });
      const printed: string[] = [];
      cli({ argv: ["--dry-run"], env: { SUPABASE_DB_URL: URL_WITH_SECRET }, psql, print: (line: string) => printed.push(line) });
      expect(printed).toEqual(["No migration is missing."]);
    });
  });

  describe("AC-13: psql is called safely", () => {
    it("puts the options first and the connection string last, and never prints it", () => {
      const seen: { command: string; args: string[] }[] = [];
      const psql = createPsql(URL_WITH_SECRET, (command: string, args: string[]) => {
        seen.push({ command, args });
        return { status: 0, stdout: "t\n", stderr: "" };
      });
      expect(psql(["-c", "select 1"])).toEqual({ status: 0, stdout: "t\n", stderr: "" });
      expect(seen[0].command).toBe("psql");
      expect(seen[0].args.at(-1)).toBe(URL_WITH_SECRET);
      expect(seen[0].args).toContain("ON_ERROR_STOP=1");
      expect(seen[0].args.indexOf("-c")).toBeLessThan(seen[0].args.length - 1);
    });

    it("reports a psql that cannot start as a failure", () => {
      const psql = createPsql(URL_WITH_SECRET, () => ({ status: null, stdout: null, stderr: null, error: new Error("spawn psql ENOENT") }));
      expect(psql(["-c", "select 1"]).status).not.toBe(0);
    });

    it("redact removes the whole string, the password (raw and decoded) and user:password", () => {
      const text = `a ${URL_WITH_SECRET} b postgres.abcd:p%40ss%2Fword c p@ss/word d`;
      const out = redact(text, URL_WITH_SECRET);
      for (const secret of ["p%40ss%2Fword", "p@ss/word", URL_WITH_SECRET]) expect(out).not.toContain(secret);
      expect(redact("no secret here", "not a url")).toBe("no secret here");
    });
  });
});
