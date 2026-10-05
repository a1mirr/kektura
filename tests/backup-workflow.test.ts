// Spec 0012 AC-1 to AC-3, AC-5 and AC-6: the properties of the backup workflow and of the dump action it shares with the
// deploy, so a later edit can't remove them unnoticed. The workflow only runs on GitHub (and needs the production
// secret); the restore drill is AC-4.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/backup.yml");
const deploy = read(".github/workflows/deploy.yml");
const action = read(".github/actions/dump-user-data/action.yml");
const lines = workflow.split("\n");

// The text of one step, from its `- name:` line to the next step of the same indent.
function stepOf(text: string, name: string) {
  const all = text.split("\n");
  const start = all.findIndex((line) => line.includes(`- name: ${name}`));
  expect(start, `a step named "${name}"`).toBeGreaterThan(-1);
  const indent = all[start].indexOf("-");
  const next = new RegExp(`^ {${indent}}- `);
  const end = all.findIndex((line, i) => i > start && next.test(line));
  return all.slice(start, end === -1 ? undefined : end).join("\n");
}
const step = (name: string) => stepOf(workflow, name);

describe("spec 0012: the backup workflow", () => {
  it("AC-1: runs weekly and by hand", () => {
    expect(workflow).toMatch(/schedule:\s*\n\s+- cron: "\d+ \d+ \* \* 1"/);
    expect(workflow).toMatch(/^ {2}workflow_dispatch:/m);
  });

  it("AC-1: dumps only data, of the auth and public schemas, with the pinned CLI, minus an exclude list", () => {
    const dump = stepOf(action, "Dump user data");
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
    const check = stepOf(action, "Check the dump");
    expect(check).toContain("PostgreSQL database dump complete");
    expect(check).toContain("auth\\.(users|identities)|public\\.(user_stamps|user_extra_stamps|profiles|friendships)");
    expect(check).toContain("rm -rf backup");
    expect(check).toContain("exit 1");
    expect(check).toContain(".github/actions/dump-user-data/action.yml"); // the error says where the exclude list is
  });

  it("AC-1: every table the migrations create in public is dumped (and checked for) or excluded", () => {
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    const created = fs
      .readdirSync(migrations)
      .flatMap((file) => [...fs.readFileSync(new URL(file, migrations), "utf8").matchAll(/create table (?:if not exists )?public\.([a-z_]+)/gi)])
      .map((m) => `public.${m[1]}`);
    expect(created.length).toBeGreaterThan(5);
    const dump = stepOf(action, "Dump user data");
    const wanted = /public\\\.\(([^)]+)\)/.exec(stepOf(action, "Check the dump"))![1].split("|").map((t) => `public.${t}`);
    const excluded = created.filter((table) => new RegExp(`${table.replace(".", "\\.")}(\\s|\\\\|$)`).test(dump));
    const neither = created.filter((table) => !wanted.includes(table) && !excluded.includes(table));
    expect(neither, "put a new table on the exclude list in the dump action, or add it to the wanted tables of its check step").toEqual([]);
    expect(wanted.filter((table) => excluded.includes(table))).toEqual([]);
  });

  it("AC-1: the weekly dump is stored as an artifact for 90 days, and a missing file is an error", () => {
    const dump = step("Dump and store the user data");
    expect(dump).toContain("artifact-name: user-data-backup");
    expect(dump).toContain("retention-days: 90");
    const upload = action.slice(action.indexOf("actions/upload-artifact"));
    expect(upload).toContain("retention-days: ${{ inputs.retention-days }}");
    expect(upload).toContain("if-no-files-found: error");
  });

  it("AC-2: without the secrets every real step is skipped and a notice says what to configure", () => {
    expect(workflow).toMatch(/CONFIGURED: \$\{\{ secrets\.SUPABASE_DB_URL != '' && secrets\.BACKUP_PUBLIC_KEY != '' \}\}/);
    expect(step("Notice when the secret is missing")).toMatch(/if: env\.CONFIGURED != 'true'\s*\n\s+run: echo "::notice[^"]*SUPABASE_DB_URL[^"]*BACKUP_PUBLIC_KEY/);
    const real = lines.filter((line) => /^ {6}(- name:|- uses:|- run:)/.test(line));
    expect(real.length).toBeGreaterThan(3);
    // every step after the notice carries the condition
    const afterNotice = workflow.slice(workflow.indexOf("- uses: actions/checkout"));
    const steps = afterNotice.split(/\n(?= {6}- )/);
    for (const text of steps) expect(text, text.split("\n")[0]).toContain("if: env.CONFIGURED == 'true'");
  });

  it("AC-3: the secret is only passed through env, never echoed, and there is no set -x", () => {
    for (const [file, text] of [
      ["backup.yml", workflow],
      ["the dump action", action],
    ]) {
      const code = text.split("\n").filter((line) => !line.trim().startsWith("#")); // the header comments say "no set -x"
      expect(code.join("\n"), file).not.toMatch(/\bset\s+-\w*x/);
      expect(code.join("\n"), file).not.toMatch(/echo[^\n]*(\$\{?SUPABASE_DB_URL|\$\{\{)/); // a notice names the secret, never expands it
    }
    const code = lines.filter((line) => !line.trim().startsWith("#"));
    const secretUses = code.filter((line) => line.includes("secrets.SUPABASE_DB_URL"));
    expect(secretUses.length).toBe(2); // the CONFIGURED flag and the dump step's env
    expect(code.filter((line) => line.includes("secrets.BACKUP_PUBLIC_KEY")).length).toBe(2); // the same
    expect(workflow).toMatch(/env:\s*\n\s+SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}\n\s+BACKUP_PUBLIC_KEY: \$\{\{ secrets\.BACKUP_PUBLIC_KEY \}\}/);
    expect(workflow).not.toMatch(/permissions:[\s\S]*write/);
  });
});

describe("spec 0012 AC-5: one dump action for every workflow that takes a dump", () => {
  it("AC-5: is a composite action under .github/actions that takes the connection string, the certificate, the artifact name and the retention", () => {
    expect(action).toMatch(/^runs:\n {2}using: composite/m);
    for (const input of ["db-url", "artifact-name", "retention-days", "encryption-cert"]) {
      expect(action, input).toMatch(new RegExp(`^ {2}${input}:\\n {4}description: .*\\n {4}required: true`, "m"));
    }
    // the string reaches the one step that dumps through its `env`, and nowhere else
    const code = action.split("\n").filter((line) => !line.trim().startsWith("#"));
    expect(code.filter((line) => line.includes("inputs.db-url"))).toEqual(["        SUPABASE_DB_URL: ${{ inputs.db-url }}"]);
    expect(stepOf(action, "Dump user data")).toMatch(/env:\s*\n\s+SUPABASE_DB_URL: \$\{\{ inputs\.db-url \}\}/);
    for (const line of code.filter((l) => /\bSUPABASE_DB_URL\b/.test(l) && !l.includes("inputs.db-url"))) expect(line, line).toContain('--db-url "$SUPABASE_DB_URL"');
  });

  it("AC-5: the table list, the exclude list and the check exist once: only the action has them", () => {
    for (const [file, text] of [
      ["backup.yml", workflow],
      ["deploy.yml", deploy],
    ]) {
      expect(text, file).not.toContain("supabase db dump");
      expect(text, file).not.toContain("auth.audit_log_entries");
      expect(text, file).not.toContain("PostgreSQL database dump complete");
      expect(text, file).toContain("uses: ./.github/actions/dump-user-data");
    }
    expect(action.match(/supabase db dump/g)).toHaveLength(1);
  });

  it("AC-5: the weekly run and the pre-migration dump differ only in the artifact's name and retention", () => {
    const inputs = (text: string, name: string) =>
      /uses: \.\/\.github\/actions\/dump-user-data\n\s+with:\n((?:\s+[a-z-]+: .*\n?)+)/
        .exec(stepOf(text, name))![1]
        .trim()
        .split("\n")
        .map((l) => l.trim().split(": ")[0]);
    expect(inputs(workflow, "Dump and store the user data")).toEqual(["db-url", "encryption-cert", "artifact-name", "retention-days"]);
    expect(inputs(deploy, "Back up the user data before migrating")).toEqual(["db-url", "encryption-cert", "artifact-name", "retention-days"]);
    // the connection string comes from the caller's env, which holds the secret
    for (const [text, name] of [
      [workflow, "Dump and store the user data"],
      [deploy, "Back up the user data before migrating"],
    ]) {
      const block = stepOf(text, name);
      expect(block, name).toMatch(/env:\s*\n\s+SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/);
      expect(block, name).toContain("db-url: ${{ env.SUPABASE_DB_URL }}");
      expect(block, name).toMatch(/BACKUP_PUBLIC_KEY: \$\{\{ secrets\.BACKUP_PUBLIC_KEY \}\}/);
      expect(block, name).toContain("encryption-cert: ${{ env.BACKUP_PUBLIC_KEY }}");
    }
  });
});

// The script of one step of the action, as bash runs it.
function runScriptOf(text: string, name: string) {
  const block = stepOf(text, name).split("\n");
  const start = block.findIndex((line) => line.trim() === "run: |");
  expect(start, `a run script in "${name}"`).toBeGreaterThan(-1);
  const indent = block[start + 1].search(/\S/);
  return block
    .slice(start + 1)
    .map((line) => line.slice(indent))
    .join("\n");
}

describe("spec 0012 AC-6: the dump is encrypted before it is stored", () => {
  it("AC-6: only the encrypted folder is uploaded, and the encryption comes after the check and before the upload", () => {
    const names = [...action.matchAll(/^ {4}- name: (.+)$/gm)].map((m) => m[1]);
    expect(names.indexOf("Check the dump")).toBeLessThan(names.indexOf("Encrypt the dump"));
    expect(names.indexOf("Encrypt the dump")).toBeLessThan(names.indexOf("Store the encrypted dump as an artifact"));
    const upload = stepOf(action, "Store the encrypted dump as an artifact");
    expect(upload).toContain("path: backup-encrypted/");
    expect(upload).not.toMatch(/path: backup\/?\s*$/m);
    expect(action.match(/actions\/upload-artifact/g)).toHaveLength(1);
  });

  it("AC-6: the certificate is read in the encrypt step's env only, and a missing or invalid one fails the step", () => {
    const code = action.split("\n").filter((line) => !line.trim().startsWith("#"));
    expect(code.filter((line) => line.includes("inputs.encryption-cert"))).toEqual(["        BACKUP_CERT: ${{ inputs.encryption-cert }}"]);
    const encrypt = stepOf(action, "Encrypt the dump");
    expect(encrypt).toMatch(/env:\s*\n\s+BACKUP_CERT: \$\{\{ inputs\.encryption-cert \}\}/);
    expect(encrypt).toContain('if [ -z "$BACKUP_CERT" ]');
    expect(encrypt).toContain("openssl x509");
    expect(encrypt).toContain("openssl cms -encrypt");
    expect(encrypt).not.toMatch(/continue-on-error/);
  });

  it("AC-6: the deploy does not skip itself when only the certificate is missing (it stops at the backup, before a migration)", () => {
    expect(deploy).not.toMatch(/CONFIGURED: .*BACKUP_PUBLIC_KEY/);
    const backup = stepOf(deploy, "Back up the user data before migrating");
    expect(backup).not.toContain("continue-on-error");
  });

  const hasTools = spawnSync("bash", ["-c", "command -v openssl"]).status === 0;
  const encryptScript = runScriptOf(action, "Encrypt the dump");

  function run(cert: string, files: Record<string, string>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kektura-encrypt-"));
    fs.mkdirSync(path.join(dir, "backup"));
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, "backup", name), text);
    const result = spawnSync("bash", ["-c", encryptScript], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, BACKUP_CERT: cert, RUNNER_TEMP: dir.replaceAll("\\", "/") },
    });
    return { dir, result };
  }
  function makeKey(dir: string) {
    const cert = path.join(dir, "cert.pem");
    const key = path.join(dir, "key.pem");
    const made = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "2", "-subj", "/CN=test"], { encoding: "utf8" });
    expect(made.status, made.stderr).toBe(0);
    return { cert: fs.readFileSync(cert, "utf8"), key };
  }

  it.skipIf(!hasTools)("AC-6: encrypts for real: only .cms files are left to upload, the plaintext is gone, and the private key restores it byte for byte", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kektura-key-"));
    const { cert, key } = makeKey(tmp);
    const sql = "INSERT INTO \"auth\".\"users\" VALUES ('a@b.hu', E'line\nbreak');\r\n-- PostgreSQL database dump complete\n";
    const { dir, result } = run(cert, { "user-data-2026-01-01.sql": sql });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(fs.readdirSync(dir).sort()).toEqual(["backup-encrypted"]); // the plaintext folder and the certificate file are gone
    const files = fs.readdirSync(path.join(dir, "backup-encrypted"));
    expect(files).toEqual(["user-data-2026-01-01.sql.cms"]);
    const encrypted = fs.readFileSync(path.join(dir, "backup-encrypted", files[0]));
    expect(encrypted.includes("a@b.hu")).toBe(false);
    const out = path.join(tmp, "restored.sql");
    const opened = spawnSync("openssl", ["cms", "-decrypt", "-binary", "-inform", "DER", "-in", path.join(dir, "backup-encrypted", files[0]), "-inkey", key, "-out", out], { encoding: "utf8" });
    expect(opened.status, opened.stderr).toBe(0);
    expect(fs.readFileSync(out, "utf8")).toBe(sql); // `-binary` matters: without it the line ends change
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it.skipIf(!hasTools)("AC-6: without a certificate, or with a private key instead of one, the step fails and leaves nothing to upload", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kektura-key-"));
    const { key } = makeKey(tmp);
    for (const cert of ["", fs.readFileSync(key, "utf8"), "not a certificate"]) {
      const { dir, result } = run(cert, { "user-data-2026-01-01.sql": "INSERT INTO x;\n" });
      expect(result.status, cert.slice(0, 20)).not.toBe(0);
      expect(result.stdout).toContain("::error title=");
      expect(fs.readdirSync(dir)).not.toContain("backup-encrypted");
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
