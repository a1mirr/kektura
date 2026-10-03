// Applies the SQL files of supabase/migrations/ that production is missing (spec 0026 AC-4, AC-6, AC-13).
//
//   node scripts/migrate-production.mjs [--dry-run] [--baseline <file>]
//
// Needs psql and SUPABASE_DB_URL (the session pooler connection string). What is applied is recorded by file name
// in public.applied_migrations, in the same transaction as the file, so a file is never applied twice and a failing
// one leaves nothing behind. The connection string and the password never reach the output.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { baselineFiles, migrationFiles, pendingMigrations, redact } from "./lib/deploy.mjs";

/** A problem to tell the user about. Thrown, not process.exit(): see the Windows note in CLAUDE.md. */
export class Problem extends Error {}

/**
 * A function that runs psql with `args` against `url` and returns { status, stdout, stderr }.
 * @param {string} url
 * @param {(command: string, args: string[], options: object) => any} [spawn]
 */
export function createPsql(url, spawn = spawnSync) {
  return (args) => {
    const result = spawn("psql", ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "-v", "ON_ERROR_STOP=1", ...args, url], {
      encoding: "utf8",
    });
    return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: `${result.stderr ?? ""}${result.error ? String(result.error.message) : ""}` };
  };
}

const quote = (name) => `'${name}'`; // file names are validated by migrationFiles(): letters, digits, `_` and `.sql`

const BOOTSTRAP = `
create table if not exists public.applied_migrations (
  file_name text primary key,
  applied_at timestamptz not null default now()
);
alter table public.applied_migrations enable row level security;
revoke all on public.applied_migrations from anon, authenticated;
`;

/**
 * The whole run. `psql` is injected so the tests need no database. Returns { applied, pending, baselined } and logs what it did through `log`.
 * @typedef {{ status: number, stdout: string, stderr: string }} PsqlResult
 * @param {{ psql: (args: string[]) => PsqlResult, dir: string, names: string[], baseline?: string, dryRun?: boolean, url?: string, log?: (line: string) => void }} options
 */
export function migrate({ psql, dir, names, baseline, dryRun = false, url = "", log = () => {} }) {
  const files = migrationFiles(names);
  const run = (args, what) => {
    const result = psql(args);
    if (result.status !== 0) throw new Problem(`${what} failed:\n${redact(result.stderr.trim() || result.stdout.trim(), url)}`);
    return result.stdout;
  };

  const hasTable = run(["-c", "select to_regclass('public.applied_migrations') is not null"], "Looking for the record table").trim() === "t";
  const applied = new Set(
    hasTable
      ? run(["-c", "select file_name from public.applied_migrations order by file_name"], "Reading the record table")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [],
  );

  let baselined = [];
  if (applied.size === 0) {
    if (!baseline) {
      throw new Problem(
        "Production has no record of applied migrations, and this script never guesses. Check that production has the " +
          "migrations you mean, then run once with --baseline <file> (the `baseline` input of a manual run): that file and " +
          "every file before it are recorded as applied without being run.",
      );
    }
    try {
      baselined = baselineFiles(files, baseline);
    } catch (error) {
      throw new Problem(error.message);
    }
    log(`Baseline: ${baselined.length} file${baselined.length === 1 ? "" : "s"} up to ${baseline} ${dryRun ? "would be" : "are"} recorded as already applied.`);
    if (!dryRun) {
      const values = baselined.map((name) => `(${quote(name)})`).join(", ");
      run(["-1", "-c", `${BOOTSTRAP}\ninsert into public.applied_migrations (file_name) values ${values} on conflict do nothing;`], "Recording the baseline");
    }
    for (const name of baselined) applied.add(name);
  } else if (baseline) {
    throw new Problem("--baseline is only for the first run: the record table already has entries.");
  }

  const pending = pendingMigrations(files, applied);
  if (pending.length === 0) log("No migration is missing.");
  if (dryRun) {
    for (const name of pending) log(`Would apply ${name}.`);
    return { applied: [], pending, baselined };
  }

  const done = [];
  for (const name of pending) {
    const file = path.join(dir, name);
    // One transaction per file: the file and its record commit together, or neither does.
    const result = psql(["-1", "-f", file, "-c", `insert into public.applied_migrations (file_name) values (${quote(name)})`]);
    if (result.status !== 0) {
      throw new Problem(`Migration ${name} failed and was rolled back; nothing was recorded.\n${redact(result.stderr.trim(), url)}`);
    }
    done.push(name);
    log(`Applied ${name}.`);
  }
  return { applied: done, pending, baselined };
}

function parseArgs(argv) {
  const options = { dryRun: false, baseline: "", dir: "supabase/migrations" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") options.dryRun = true;
    else if (argv[i] === "--baseline") options.baseline = argv[++i] ?? "";
    else if (argv[i] === "--dir") options.dir = argv[++i] ?? options.dir;
    else throw new Problem(`Unknown argument ${JSON.stringify(argv[i])}.`);
  }
  return options;
}

function main() {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) throw new Problem("SUPABASE_DB_URL is not set.");
  const options = parseArgs(process.argv.slice(2));
  const summary = process.env.GITHUB_STEP_SUMMARY;
  const lines = [];
  const log = (line) => {
    console.log(line);
    lines.push(`- ${line}`);
  };
  try {
    migrate({ psql: createPsql(url), dir: options.dir, names: fs.readdirSync(options.dir), baseline: options.baseline, dryRun: options.dryRun, url, log });
  } finally {
    if (summary && lines.length) fs.appendFileSync(summary, `### Migrations${options.dryRun ? " (dry run)" : ""}\n${lines.join("\n")}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    if (error instanceof Problem) {
      console.error(error.message);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
