// Spec 0012 AC-1 to AC-3: the properties of the backup workflow, so a later edit can't remove them unnoticed.
// The workflow only runs on GitHub (and needs the production secret); the restore drill is AC-4.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(new URL("../.github/workflows/backup.yml", import.meta.url), "utf8");
const lines = workflow.split("\n");

function step(name: string) {
  const start = lines.findIndex((line) => line.includes(`- name: ${name}`));
  expect(start, `a step named "${name}"`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, i) => i > start && /^ {6}- /.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("spec 0012: the backup workflow", () => {
  it("AC-1: runs weekly and by hand", () => {
    expect(workflow).toMatch(/schedule:\s*\n\s+- cron: "\d+ \d+ \* \* 1"/);
    expect(workflow).toMatch(/^ {2}workflow_dispatch:/m);
  });

  it("AC-1: dumps only data, of the auth and public schemas, with the pinned CLI, minus an exclude list", () => {
    const dump = step("Dump user data");
    expect(dump).toMatch(/npx supabase db dump --db-url "\$SUPABASE_DB_URL" --data-only --schema auth,public/);
    expect(dump).toContain('"${exclude[@]}"');
    expect(dump).toContain("--file");
    // reference data and the deploy record are not user data
    for (const table of ["public.checkpoints", "public.extra_stamps", "public.applied_migrations", "auth.sessions", "auth.refresh_tokens"]) {
      expect(dump, table).toContain(table);
    }
    // the six wanted tables are never excluded
    for (const table of ["auth.users", "auth.identities", "public.user_stamps", "public.user_extra_stamps", "public.profiles", "public.friendships"]) {
      expect(dump, table).not.toMatch(new RegExp(`${table.replace(".", "\\.")}(\\s|$)`));
    }
  });

  it("AC-1: a check step fails the run and deletes the dump when a table other than the six turns up", () => {
    const check = step("Check the dump");
    expect(check).toContain("auth\\.(users|identities)|public\\.(user_stamps|user_extra_stamps|profiles|friendships)");
    expect(check).toContain("rm -rf backup");
    expect(check).toContain("exit 1");
  });

  it("AC-1: every table the migrations create in public is dumped (and checked for) or excluded", () => {
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    const created = fs
      .readdirSync(migrations)
      .flatMap((file) => [...fs.readFileSync(new URL(file, migrations), "utf8").matchAll(/create table (?:if not exists )?public\.([a-z_]+)/gi)])
      .map((m) => `public.${m[1]}`);
    expect(created.length).toBeGreaterThan(5);
    const dump = step("Dump user data");
    const wanted = /public\\\.\(([^)]+)\)/.exec(step("Check the dump"))![1].split("|").map((t) => `public.${t}`);
    const excluded = created.filter((table) => new RegExp(`${table.replace(".", "\\.")}(\\s|\\\\|$)`).test(dump));
    const neither = created.filter((table) => !wanted.includes(table) && !excluded.includes(table));
    expect(neither, "put a new table on the exclude list in backup.yml, or add it to the wanted tables of the check step").toEqual([]);
    expect(wanted.filter((table) => excluded.includes(table))).toEqual([]);
  });

  it("AC-1: the dump is stored as an artifact for 90 days, and a missing file is an error", () => {
    const upload = workflow.slice(workflow.indexOf("actions/upload-artifact"));
    expect(upload).toContain("retention-days: 90");
    expect(upload).toContain("if-no-files-found: error");
  });

  it("AC-2: without the secret every real step is skipped and a notice says what to configure", () => {
    expect(workflow).toMatch(/CONFIGURED: \$\{\{ secrets\.SUPABASE_DB_URL != '' \}\}/);
    expect(step("Notice when the secret is missing")).toMatch(/if: env\.CONFIGURED != 'true'\s*\n\s+run: echo "::notice[^"]*SUPABASE_DB_URL/);
    const real = lines.filter((line) => /^ {6}(- name:|- uses:|- run:)/.test(line));
    expect(real.length).toBeGreaterThan(4);
    // every step after the notice carries the condition
    const afterNotice = workflow.slice(workflow.indexOf("- uses: actions/checkout"));
    const steps = afterNotice.split(/\n(?= {6}- )/);
    for (const text of steps) expect(text, text.split("\n")[0]).toContain("if: env.CONFIGURED == 'true'");
  });

  it("AC-3: the secret is only passed through env, never echoed, and there is no set -x", () => {
    const code = lines.filter((line) => !line.trim().startsWith("#")); // the header comment says "no set -x"
    expect(code.join("\n")).not.toMatch(/\bset\s+-\w*x/);
    const secretUses = code.filter((line) => line.includes("secrets.SUPABASE_DB_URL"));
    expect(secretUses.length).toBe(2); // the CONFIGURED flag and the dump step's env
    expect(workflow).toMatch(/env:\s*\n\s+SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/);
    expect(code.join("\n")).not.toMatch(/echo[^\n]*(\$\{?SUPABASE_DB_URL|\$\{\{)/); // the notice names the secret, never expands it
    expect(workflow).not.toMatch(/permissions:[\s\S]*write/);
  });
});
