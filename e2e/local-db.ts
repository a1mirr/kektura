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
