import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setExtraStamped, setPlacesStamped } from "./actions";

type Call = { table: string; op: string; args: unknown[] };

// Minimal stand-in for the Supabase client: records every query-builder call and answers the
// checkpoint lookup from `checkpoints`.
function fakeSupabase({
  user = { id: "user-1" } as { id: string } | null,
  checkpoints = [] as { id: number; place_key: string }[],
  readError = null as unknown,
  writeError = null as unknown,
} = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    let result: { data?: unknown; error: unknown } = { error: null };
    const record = (op: string, args: unknown[]) => calls.push({ table, op, args });
    const q = {
      select(...args: unknown[]) {
        record("select", args);
        result = { data: checkpoints, error: readError };
        return q;
      },
      in(column: string, values: unknown[]) {
        record("in", [column, values]);
        if (column === "place_key") {
          result = { ...result, data: checkpoints.filter((c) => values.includes(c.place_key)) };
        }
        return q;
      },
      eq(...args: unknown[]) {
        record("eq", args);
        return q;
      },
      delete() {
        record("delete", []);
        result = { error: writeError };
        return q;
      },
      upsert(...args: unknown[]) {
        record("upsert", args);
        return Promise.resolve({ error: writeError });
      },
      then(resolve: (r: typeof result) => unknown, reject: (e: unknown) => unknown) {
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return q;
  };
  const client = { auth: { getUser: vi.fn(async () => ({ data: { user } })) }, from };
  return { client, calls };
}

function useClient(fake: ReturnType<typeof fakeSupabase>) {
  vi.mocked(createClient).mockResolvedValue(fake.client as never);
  return fake;
}

const writes = (calls: Call[]) => calls.filter((c) => c.op === "upsert" || c.op === "delete");

beforeEach(() => {
  vi.clearAllMocks();
});

const KOSZEG = [
  { id: 4, place_key: "OKTPH_03" },
  { id: 5, place_key: "OKTPH_03" },
];

describe("spec 0002: setPlacesStamped", () => {
  it.each([
    ["no keys", [], true],
    ["too many keys", Array.from({ length: 201 }, (_, i) => `K${i}`), true],
    ["a non-string key", [42], true],
    ["an over-long key", ["x".repeat(65)], true],
    ["a non-boolean flag", ["OKTPH_03"], "yes"],
  ])("AC-1: rejects %s without touching the database", async (_, keys, stamped) => {
    expect(await setPlacesStamped(keys as string[], stamped as boolean)).toEqual({ ok: false, reason: "failed" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("AC-2: returns `unauthorized` without a signed-in user", async () => {
    const { calls } = useClient(fakeSupabase({ user: null, checkpoints: KOSZEG }));
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual({ ok: false, reason: "unauthorized" });
    expect(writes(calls)).toEqual([]);
  });

  it("AC-3: stamping a place stamps every variant, as the user, without overwriting old stamps", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: [...KOSZEG, { id: 9, place_key: "OKTPH_07" }] }));
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual({ ok: true });
    expect(writes(calls)).toEqual([
      {
        table: "user_stamps",
        op: "upsert",
        args: [
          [
            { user_id: "user-1", checkpoint_id: 4 },
            { user_id: "user-1", checkpoint_id: 5 },
          ],
          { ignoreDuplicates: true },
        ],
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/dashboard", "page");
  });

  it("AC-4: unstamping deletes only the user's rows for every variant", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG }));
    expect(await setPlacesStamped(["OKTPH_03"], false)).toEqual({ ok: true });
    const userStamps = calls.filter((c) => c.table === "user_stamps");
    expect(userStamps).toEqual([
      { table: "user_stamps", op: "delete", args: [] },
      { table: "user_stamps", op: "eq", args: ["user_id", "user-1"] },
      { table: "user_stamps", op: "in", args: ["checkpoint_id", [4, 5]] },
    ]);
  });

  it("AC-5: unknown place keys fail without writing", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG }));
    expect(await setPlacesStamped(["NOPE"], true)).toEqual({ ok: false, reason: "failed" });
    expect(writes(calls)).toEqual([]);
  });

  it("AC-6: database errors are reported as `failed` and nothing is revalidated", async () => {
    useClient(fakeSupabase({ checkpoints: KOSZEG, writeError: { message: "boom" } }));
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual({ ok: false, reason: "failed" });
    useClient(fakeSupabase({ checkpoints: KOSZEG, readError: { message: "boom" } }));
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual({ ok: false, reason: "failed" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AC-7: never throws, even when the client itself does", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("cookies() unavailable"));
    await expect(setPlacesStamped(["OKTPH_03"], true)).resolves.toEqual({ ok: false, reason: "failed" });
  });
});

describe("spec 0002: setExtraStamped", () => {
  it("AC-1: rejects a non-integer id", async () => {
    expect(await setExtraStamped(1.5, true)).toEqual({ ok: false, reason: "failed" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("AC-2: returns `unauthorized` without a signed-in user", async () => {
    useClient(fakeSupabase({ user: null }));
    expect(await setExtraStamped(7, true)).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("AC-8: stamping uses ON CONFLICT DO NOTHING (the table has no UPDATE policy)", async () => {
    const { calls } = useClient(fakeSupabase());
    expect(await setExtraStamped(7, true)).toEqual({ ok: true });
    expect(writes(calls)).toEqual([
      {
        table: "user_extra_stamps",
        op: "upsert",
        args: [{ user_id: "user-1", extra_id: 7 }, { ignoreDuplicates: true }],
      },
    ]);
  });

  it("AC-8: unstamping deletes only the user's row", async () => {
    const { calls } = useClient(fakeSupabase());
    expect(await setExtraStamped(7, false)).toEqual({ ok: true });
    expect(calls).toEqual([
      { table: "user_extra_stamps", op: "delete", args: [] },
      { table: "user_extra_stamps", op: "eq", args: ["user_id", "user-1"] },
      { table: "user_extra_stamps", op: "eq", args: ["extra_id", 7] },
    ]);
  });

  it("AC-7: never throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("offline"));
    await expect(setExtraStamped(7, true)).resolves.toEqual({ ok: false, reason: "failed" });
  });
});
