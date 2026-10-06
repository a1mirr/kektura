// Direct access to the local test Supabase for tests that check the database rules themselves
// (spec 0017 AC-3, spec 0014): the REST API as an anonymous caller, and SQL through the container.
import { execFileSync, execSync } from "node:child_process";
import type { APIRequestContext } from "@playwright/test";

type LocalStatus = { API_URL: string; ANON_KEY?: string; PUBLISHABLE_KEY?: string; SERVICE_ROLE_KEY?: string; SECRET_KEY?: string };

let status: LocalStatus | undefined;

// Same source as scripts/test-env.mjs: `supabase status`, which prints the local URL and public key.
export function localSupabase() {
  if (!status) {
    const out = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    status = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as LocalStatus;
  }
  return { url: status.API_URL, anonKey: (status.ANON_KEY ?? status.PUBLISHABLE_KEY)!, serviceKey: (status.SERVICE_ROLE_KEY ?? status.SECRET_KEY)! };
}

// REST call as the anonymous role (the public key, no user session). Goes through Playwright's request
// context: Node's own fetch leaves keep-alive sockets open, and on Windows that makes the worker die
// with a libuv assertion at teardown.
export async function anonRest(
  request: APIRequestContext,
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
  const { url, anonKey } = localSupabase();
  return request.fetch(`${url}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: { apikey: anonKey, "content-type": "application/json", prefer: "return=minimal" },
    data: init.body,
  });
}

// Runs one SQL statement as the postgres user in the local database container and returns the rows
// as unaligned text (one line per row, `|` between columns).
export function psql(sql: string): string {
  return execFileSync("docker", ["exec", "supabase_db_kektura", "psql", "-U", "postgres", "-tA", "-c", sql], {
    encoding: "utf8",
  }).trim();
}

// ---- Skip or fail when the database is not there (spec 0007 AC-12) --------------------------------------------------
// Every test file that needs the local database calls `requireDatabase(ctx, relations)` at the top of each test, and no
// file decides on its own: without a database the tests skip and say why, except where `REQUIRE_LOCAL_DB` is set (only
// the end-to-end job's database step sets it), where a missing database or schema fails the test.

export const NOT_RUNNING_MESSAGE = "the local Supabase is not running: `npm run testdb:start`";

type Env = Record<string, string | undefined>;
export type DatabaseState = { reachable: boolean; missing: string[] };
export type DatabaseDecision = { action: "run" } | { action: "skip"; reason: string } | { action: "fail"; message: string };

// Set, and not empty, "0" or "false", means the database is required.
export function databaseRequired(env: Env): boolean {
  const value = (env.REQUIRE_LOCAL_DB ?? "").trim().toLowerCase();
  return value !== "" && value !== "0" && value !== "false";
}

// The decision itself, pure: what the state of the database and the environment mean for a test.
export function decideDatabase(state: DatabaseState, env: Env): DatabaseDecision {
  const problem = !state.reachable
    ? NOT_RUNNING_MESSAGE
    : state.missing.length > 0
      ? `the local database lacks ${state.missing.join(", ")}: \`npm run testdb:reset\``
      : undefined;
  if (!problem) return { action: "run" };
  return databaseRequired(env) ? { action: "fail", message: problem } : { action: "skip", reason: problem };
}

// "Reachable" is the probe of `localSupabase()`: `supabase status` answers. Asked once per test file.
let reachable: boolean | undefined;
export function databaseReachable(): boolean {
  if (reachable === undefined) {
    try {
      localSupabase();
      reachable = true;
    } catch {
      reachable = false;
    }
  }
  return reachable;
}

// Which of the given tables (`public.checkpoints`) the running database does not have: one query for the whole list.
const missingCache = new Map<string, string[]>();
function missingRelations(relations: string[]): string[] {
  const key = relations.join(",");
  if (!missingCache.has(key)) {
    const list = relations.map((r) => `'${r.replaceAll("'", "''")}'`).join(", ");
    const out = psql(`select coalesce(string_agg(r, ','), '') from unnest(array[${list}]) as r where to_regclass(r) is null`);
    missingCache.set(key, out === "" ? [] : out.split(","));
  }
  return missingCache.get(key)!;
}

// What the current environment decides for a file that needs the given tables. The probes run only when needed; a
// database that cannot be asked counts as not reachable.
export function databaseDecision(relations: string[] = [], env: Env = process.env): DatabaseDecision {
  if (!databaseReachable()) return decideDatabase({ reachable: false, missing: [] }, env);
  let missing: string[] = [];
  if (relations.length > 0) {
    try {
      missing = missingRelations(relations);
    } catch {
      return decideDatabase({ reachable: false, missing: [] }, env);
    }
  }
  return decideDatabase({ reachable: true, missing }, env);
}

// First line of every database test: skips the test and says why, fails it with the message, or returns the connection
// details of the local database. `relations` are the tables the file expects, so a running database without that
// schema is the same problem as one that is not running.
export function requireDatabase(ctx: SkippableTest, relations: string[] = [], env: Env = process.env) {
  enforceDecision(ctx, databaseDecision(relations, env));
  return localSupabase();
}

type SkippableTest = { skip: (note?: string) => never };

// Applies a decision to a test: skips it, fails it by throwing the message, or lets it run.
export function enforceDecision(ctx: SkippableTest, decision: DatabaseDecision): void {
  if (decision.action === "skip") ctx.skip(decision.reason);
  if (decision.action === "fail") throw new Error(decision.message);
}
