// Spec 0026 AC-8 and spec 0006 AC-4: the smoke test, against a local server whose answers the test controls.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { checkOnce, smoke, Problem } from "../scripts/smoke-test.mjs";

type Answers = Record<string, number>;

let server: http.Server | undefined;
const requests: string[] = [];
const methods: string[] = [];
const CHECKS_PER_ROUND = 6;

// Starts a server that answers each path with the status in `answers` (404 for any other path).
async function serve(answers: Answers, beforeReady = 0) {
  let served = 0;
  server = http.createServer((request, response) => {
    requests.push(request.url ?? "");
    methods.push(request.method ?? "");
    const failing = served++ < beforeReady * CHECKS_PER_ROUND;
    response.statusCode = failing ? 502 : (answers[request.url ?? ""] ?? 404);
    response.end("x");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  requests.length = 0;
  methods.length = 0;
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = undefined;
});

const HEALTHY = { "/hu": 200, "/en": 200, "/de": 200, "/ru": 200 };
const fast = { intervalMs: 20, sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) };

describe("spec 0026 AC-8: the smoke test", () => {
  it("passes when /hu, /en, /de and /ru answer 200 and an unknown route answers 404", async () => {
    const base = await serve(HEALTHY);
    expect(await checkOnce(base)).toEqual([]);
    expect(requests).toEqual(["/hu", "/en", "/de", "/ru", "/en/smoke-test-no-such-page", "/auth/test-login"]);
  });

  it("0006 AC-4: posts to the dummy login and fails when it signs anybody in instead of answering 404", async () => {
    const open = await serve({ ...HEALTHY, "/auth/test-login": 303 });
    expect(await checkOnce(open)).toEqual(["/auth/test-login: expected 404, got 303"]);
    expect(methods.at(-1)).toBe("POST");
    expect(methods.slice(0, 5)).toEqual(["GET", "GET", "GET", "GET", "GET"]);
  });

  it("says which route is wrong and what it answered", async () => {
    const base = await serve({ ...HEALTHY, "/ru": 500 });
    expect(await checkOnce(base)).toEqual(["/ru: expected 200, got 500"]);
  });

  it("fails when the unknown route does not answer 404 (the not-found handling is broken)", async () => {
    const base = await serve({ ...HEALTHY, "/en/smoke-test-no-such-page": 200 });
    expect(await checkOnce(base)).toEqual(["/en/smoke-test-no-such-page: expected 404, got 200"]);
  });

  it("treats a redirect as a failure instead of following it", async () => {
    const base = await serve({ ...HEALTHY, "/en": 301 });
    expect(await checkOnce(base)).toEqual(["/en: expected 200, got 301"]);
  });

  it("reports a server that is not there at all, without the URL", async () => {
    const wrong = await checkOnce("http://127.0.0.1:1");
    expect(wrong).toHaveLength(CHECKS_PER_ROUND);
    for (const line of wrong) expect(line).toMatch(/no answer \(\w+\)$/);
    expect(wrong.join()).not.toContain("127.0.0.1");
  });

  it("retries while the reload is still going, then passes", async () => {
    const base = await serve(HEALTHY, 2); // the first two rounds fail with 502
    const log: string[] = [];
    const attempts = await smoke({ base, timeoutMs: 5_000, log: (line) => log.push(line), ...fast });
    expect(attempts).toBe(3);
    expect(log[0]).toMatch(/^Attempt 1: .*502/);
    expect(log.at(-1)).toBe("Smoke test passed on attempt 3.");
  });

  it("gives up after the timeout with a Problem naming what is wrong", async () => {
    const base = await serve({ ...HEALTHY, "/ru": 503 });
    const error = await smoke({ base, timeoutMs: 1_000, ...fast }).catch((caught) => caught);
    expect(error).toBeInstanceOf(Problem);
    expect(error.message).toMatch(/did not come up healthy within 1 s: \/ru: expected 200, got 503/);
  });

  it("stops retrying at the deadline (with a fake clock, no real waiting)", async () => {
    const base = await serve({ "/hu": 500, "/en": 500, "/de": 500, "/ru": 500 });
    let time = 0;
    const sleeps: number[] = [];
    await expect(
      smoke({
        base,
        timeoutMs: 120_000,
        intervalMs: 5_000,
        now: () => time,
        sleep: async (ms: number) => {
          sleeps.push(ms);
          time += ms;
        },
      }),
    ).rejects.toThrow(/within 120 s/);
    expect(sleeps).toHaveLength(24); // 24 waits of 5 s fit before the 120 s deadline; the next would pass it
    expect(sleeps.every((ms) => ms === 5_000)).toBe(true);
  });
});
