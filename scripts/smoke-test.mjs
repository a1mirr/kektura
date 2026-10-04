// Checks that the site answers after a deploy (spec 0026 AC-8): /en and /ru give 200, an unknown route gives
// 404, and the test server's dummy login is not there (404, spec 0006 AC-4). It is a sanity check of the running build, not a test suite. It retries, because the reload takes a moment.
// The scheduled uptime check (spec 0066) runs the same checks, so a change here changes both.
//
//   node scripts/smoke-test.mjs <base url> [timeout seconds]
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** A problem to tell the user about. Thrown, not process.exit(): see the Windows note in CLAUDE.md. */
export class Problem extends Error {}

export const CHECKS = [
  { path: "/en", status: 200 },
  { path: "/ru", status: 200 },
  { path: "/en/smoke-test-no-such-page", status: 404 },
  // The dummy login signs anybody in: a stray TEST_LOGIN=1 must never open it on the public address.
  { path: "/auth/test-login", status: 404, method: "POST" },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs every check once; returns the list of what is wrong (empty when all is well).
 * @param {string} base
 * @param {(url: URL, init: object) => Promise<any>} [fetchFn]
 * @returns {Promise<string[]>}
 */
export async function checkOnce(base, fetchFn = fetch) {
  const wrong = [];
  for (const { path, status, method = "GET" } of CHECKS) {
    try {
      const response = await fetchFn(new URL(path, base), { method, redirect: "manual", signal: AbortSignal.timeout(10_000) });
      await response.arrayBuffer().catch(() => {}); // release the connection
      if (response.status !== status) wrong.push(`${path}: expected ${status}, got ${response.status}`);
    } catch (error) {
      wrong.push(`${path}: no answer (${error instanceof Error ? error.name : "error"})`);
    }
  }
  return wrong;
}

/**
 * Retries until every check passes or `timeoutMs` has passed.
 * @param {{ base: string, timeoutMs?: number, intervalMs?: number, fetchFn?: (url: URL, init: object) => Promise<any>, sleep?: (ms: number) => Promise<void>, now?: () => number, log?: (line: string) => void }} options
 */
export async function smoke({ base, timeoutMs = 120_000, intervalMs = 5_000, fetchFn = fetch, sleep = wait, now = Date.now, log = () => {} }) {
  const deadline = now() + timeoutMs;
  for (let attempt = 1; ; attempt++) {
    const wrong = await checkOnce(base, fetchFn);
    if (wrong.length === 0) {
      log(`Smoke test passed on attempt ${attempt}.`);
      return attempt;
    }
    log(`Attempt ${attempt}: ${wrong.join("; ")}`);
    if (now() + intervalMs > deadline) throw new Problem(`The site did not come up healthy within ${Math.round(timeoutMs / 1000)} s: ${wrong.join("; ")}`);
    await sleep(intervalMs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const base = process.argv[2];
    if (!base) throw new Problem("Usage: node scripts/smoke-test.mjs <base url> [timeout seconds]");
    const timeoutMs = Number(process.argv[3] ?? 120) * 1000;
    const lines = [];
    try {
      await smoke({
        base,
        timeoutMs,
        log: (line) => {
          console.log(line);
          lines.push(`- ${line}`);
        },
      });
    } finally {
      const summary = process.env.GITHUB_STEP_SUMMARY;
      if (summary && lines.length) fs.appendFileSync(summary, ["### Smoke test", ...lines, ""].join("\n"));
    }
  } catch (error) {
    if (!(error instanceof Problem)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}
