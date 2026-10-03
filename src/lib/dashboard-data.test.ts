import { beforeEach, describe, expect, it, vi } from "vitest";

// unstable_cache is replaced by a pass-through that remembers its options, so the tests can check what
// would be cached and for how long without a Next runtime.
const cacheOptions = vi.hoisted(() => ({
  calls: [] as { keyParts: string[]; options: { tags?: string[]; revalidate?: number } }[],
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keyParts: string[], options: { tags?: string[]; revalidate?: number }) => {
    cacheOptions.calls.push({ keyParts, options });
    return fn;
  },
}));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: vi.fn() }));

import { createPublicClient } from "@/lib/supabase/public";
import { REFERENCE_DATA_REVALIDATE_SECONDS, REFERENCE_DATA_TAG, loadDashboardData } from "./dashboard-data";

// A client stand-in that records which tables are read and answers each from `tables`.
function fakeClient(tables: Record<string, { data?: unknown[]; error?: unknown }>) {
  const read: string[] = [];
  const client = {
    from(table: string) {
      read.push(table);
      const result = { data: tables[table]?.data ?? null, error: tables[table]?.error ?? null };
      const q = { select: () => q, order: () => q, then: (resolve: (r: typeof result) => unknown) => resolve(result) };
      return q;
    },
  };
  return { client: client as never, read };
}

const checkpoints = [{ id: 1, name: "Írott-kő" }];
const extras = [{ id: 7, name: "Extra" }];

describe("spec 0009: dashboard data", () => {
  beforeEach(() => vi.mocked(createPublicClient).mockReset());

  it("AC-1: checkpoints and extra stamps are read through the cookie-less client, never the user's", async () => {
    const pub = fakeClient({ checkpoints: { data: checkpoints }, extra_stamps: { data: extras } });
    vi.mocked(createPublicClient).mockReturnValue(pub.client);
    const user = fakeClient({ user_stamps: { data: [] }, user_extra_stamps: { data: [] } });

    const data = await loadDashboardData(user.client);

    expect(data.checkpoints).toEqual(checkpoints);
    expect(data.extras).toEqual(extras);
    expect(pub.read.sort()).toEqual(["checkpoints", "extra_stamps"]);
    expect(user.read).not.toContain("checkpoints");
    expect(user.read).not.toContain("extra_stamps");
  });

  it("AC-1: the reference data is cached for at most one day under a tag that can expire it", () => {
    const entry = cacheOptions.calls.find((c) => c.options.tags?.includes(REFERENCE_DATA_TAG));
    expect(entry).toBeDefined();
    expect(entry!.options.revalidate).toBe(REFERENCE_DATA_REVALIDATE_SECONDS);
    expect(REFERENCE_DATA_REVALIDATE_SECONDS).toBeLessThanOrEqual(60 * 60 * 24);
    expect(cacheOptions.calls).toHaveLength(1); // the only cached read is the reference data
  });

  it("AC-1: a failed reference read throws, so an empty result is never cached", async () => {
    const pub = fakeClient({ checkpoints: { error: { message: "boom" } }, extra_stamps: { data: extras } });
    vi.mocked(createPublicClient).mockReturnValue(pub.client);
    await expect(loadDashboardData(fakeClient({}).client)).rejects.toThrow();
  });

  it("AC-2: the user's stamps are read per request through the cookie-based client", async () => {
    const pub = fakeClient({ checkpoints: { data: checkpoints }, extra_stamps: { data: extras } });
    vi.mocked(createPublicClient).mockReturnValue(pub.client);
    const stamps = [{ checkpoint_id: 1, stamped_on: "2026-05-01" }];
    const extraStamps = [{ extra_id: 7, stamped_on: "2026-05-02" }];
    const user = fakeClient({ user_stamps: { data: stamps }, user_extra_stamps: { data: extraStamps } });

    const data = await loadDashboardData(user.client);

    expect(user.read.sort()).toEqual(["user_extra_stamps", "user_stamps"]);
    expect(pub.read).not.toContain("user_stamps");
    expect(pub.read).not.toContain("user_extra_stamps");
    expect(data.stamps).toEqual(stamps);
    expect(data.extraStamps).toEqual(extraStamps);
  });
});
