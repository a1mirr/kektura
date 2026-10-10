import { execFileSync, execSync } from "node:child_process";
import type { APIRequestContext } from "@playwright/test";

type LocalStatus = { API_URL: string; ANON_KEY?: string; PUBLISHABLE_KEY?: string; SERVICE_ROLE_KEY?: string; SECRET_KEY?: string };

let status: LocalStatus | undefined;

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

export function psql(sql: string): string {
  return execFileSync("docker", ["exec", "supabase_db_kektura", "psql", "-U", "postgres", "-tA", "-c", sql], {
    encoding: "utf8",
  }).trim();
}

export const NOT_RUNNING_MESSAGE = "the local Supabase is not running: `npm run testdb:start`";

type Env = Record<string, string | undefined>;
export type DatabaseState = { reachable: boolean; missing: string[] };
export type DatabaseDecision = { action: "run" } | { action: "skip"; reason: string } | { action: "fail"; message: string };

export function databaseRequired(env: Env): boolean {
  const value = (env.REQUIRE_LOCAL_DB ?? "").trim().toLowerCase();
  return value !== "" && value !== "0" && value !== "false";
}

export function decideDatabase(state: DatabaseState, env: Env): DatabaseDecision {
  const problem = !state.reachable
    ? NOT_RUNNING_MESSAGE
    : state.missing.length > 0
      ? `the local database lacks ${state.missing.join(", ")}: \`npm run testdb:reset\``
      : undefined;
  if (!problem) return { action: "run" };
  return databaseRequired(env) ? { action: "fail", message: problem } : { action: "skip", reason: problem };
}

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

export function requireDatabase(ctx: SkippableTest, relations: string[] = [], env: Env = process.env) {
  enforceDecision(ctx, databaseDecision(relations, env));
  return localSupabase();
}

type SkippableTest = { skip: (note?: string) => never };

export function enforceDecision(ctx: SkippableTest, decision: DatabaseDecision): void {
  if (decision.action === "skip") ctx.skip(decision.reason);
  if (decision.action === "fail") throw new Error(decision.message);
}
