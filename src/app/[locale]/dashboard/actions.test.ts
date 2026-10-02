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
  user = { id: "user-1" } as { id: string; email?: string } | null,
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

// The actions log failures (spec 0008). Spying keeps the output quiet and lets the 0008 tests read it.
const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
const warnLog = vi.spyOn(console, "warn").mockImplementation(() => {});

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

  it("AC-3: explicit date updates stamped_on for existing rows", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG }));
    expect(await setPlacesStamped(["OKTPH_03"], true, "2023-10-01")).toEqual({ ok: true });
    expect(writes(calls)).toEqual([
      {
        table: "user_stamps",
        op: "upsert",
        args: [
          [
            { user_id: "user-1", checkpoint_id: 4, stamped_on: "2023-10-01" },
            { user_id: "user-1", checkpoint_id: 5, stamped_on: "2023-10-01" },
          ],
          { onConflict: "user_id, checkpoint_id" },
        ],
      },
    ]);
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

  it("AC-8: stamping with explicit date uses ON CONFLICT to update stamped_on", async () => {
    const { calls } = useClient(fakeSupabase());
    expect(await setExtraStamped(7, true, "2023-10-01")).toEqual({ ok: true });
    expect(writes(calls)).toEqual([
      {
        table: "user_extra_stamps",
        op: "upsert",
        args: [{ user_id: "user-1", extra_id: 7, stamped_on: "2023-10-01" }, { onConflict: "user_id, extra_id" }],
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

// A Supabase error as PostgREST sends it: `details` and `hint` can quote row values, so they must
// never reach the log.
const dbError = (message: string, code = "42501") => ({
  code,
  message,
  details: "Key (user_id)=(secret-details) is not present",
  hint: "secret-hint",
});

describe("spec 0008: logging of failed stamp actions", () => {
  const FAILED = { ok: false, reason: "failed" };

  it("AC-1: a failed read logs one line with action, stage, user, code and message", async () => {
    useClient(fakeSupabase({ checkpoints: KOSZEG, readError: dbError("permission denied for table checkpoints") }));
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual(FAILED);
    expect(errorLog.mock.calls).toEqual([
      ['[stamp-action] action=setPlacesStamped stage=read user=user-1 code=42501 message="permission denied for table checkpoints"'],
    ]);
    expect(warnLog).not.toHaveBeenCalled();
  });

  it.each([true, false])("AC-1: a failed write (stamped=%s) logs one `write` line", async (stamped) => {
    useClient(fakeSupabase({ checkpoints: KOSZEG, writeError: dbError("new row violates row-level security policy", "42501") }));
    expect(await setPlacesStamped(["OKTPH_03"], stamped)).toEqual(FAILED);
    expect(errorLog.mock.calls).toEqual([
      ['[stamp-action] action=setPlacesStamped stage=write user=user-1 code=42501 message="new row violates row-level security policy"'],
    ]);
  });

  it.each([true, false])("AC-1: setExtraStamped logs a failed write (stamped=%s)", async (stamped) => {
    useClient(fakeSupabase({ writeError: dbError("insert or update violates foreign key constraint", "23503") }));
    expect(await setExtraStamped(7, stamped)).toEqual(FAILED);
    expect(errorLog.mock.calls).toEqual([
      ['[stamp-action] action=setExtraStamped stage=write user=user-1 code=23503 message="insert or update violates foreign key constraint"'],
    ]);
  });

  it("AC-1: an exception before the session is known logs one `exception` line without a user", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("cookies() unavailable"));
    expect(await setExtraStamped(7, true)).toEqual(FAILED);
    expect(errorLog.mock.calls).toEqual([
      ['[stamp-action] action=setExtraStamped stage=exception user=unknown code=- message="cookies() unavailable"'],
    ]);
  });

  it("AC-1: an exception after sign-in logs the user id", async () => {
    const fake = useClient(fakeSupabase({ checkpoints: KOSZEG }));
    fake.client.from = () => {
      throw new Error("socket hang up");
    };
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual(FAILED);
    expect(errorLog.mock.calls).toEqual([
      ['[stamp-action] action=setPlacesStamped stage=exception user=user-1 code=- message="socket hang up"'],
    ]);
  });

  it("AC-1: a successful action and an unknown place key log nothing", async () => {
    useClient(fakeSupabase({ checkpoints: KOSZEG }));
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual({ ok: true });
    expect(await setPlacesStamped(["NOPE"], true)).toEqual(FAILED);
    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
  });

  it("AC-2: logs never contain the email, the request input, or the error's details and hint", async () => {
    const user = { id: "user-1", email: "hiker@example.com" };
    useClient(fakeSupabase({ user, checkpoints: KOSZEG, readError: dbError("boom") }));
    await setPlacesStamped(["OKTPH_03"], true);
    useClient(fakeSupabase({ user, checkpoints: KOSZEG, writeError: dbError("boom") }));
    await setPlacesStamped(["OKTPH_03"], true);
    await setExtraStamped(7, true);
    const thrown = fakeSupabase({ user, checkpoints: KOSZEG });
    thrown.client.from = () => {
      throw new Error("socket hang up");
    };
    useClient(thrown);
    await setPlacesStamped(["OKTPH_03"], false);

    expect(errorLog).toHaveBeenCalledTimes(4);
    const logged = JSON.stringify([...errorLog.mock.calls, ...warnLog.mock.calls]);
    for (const secret of ["hiker@example.com", "OKTPH_03", "secret-details", "secret-hint"]) {
      expect(logged).not.toContain(secret);
    }
  });

  it.each([
    ["no keys", [], true],
    ["too many keys", Array.from({ length: 201 }, (_, i) => `K${i}`), true],
    ["a non-string key", ["secret-key", 42], true],
    ["an over-long key", ["x".repeat(65)], true],
    ["a non-boolean flag", ["secret-key"], "yes"],
  ])("AC-3: rejected input (%s) logs one warning without echoing it", async (_, keys, stamped) => {
    expect(await setPlacesStamped(keys as string[], stamped as boolean)).toEqual(FAILED);
    expect(warnLog.mock.calls).toEqual([["[stamp-action] invalid input action=setPlacesStamped"]]);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("AC-3: setExtraStamped logs rejected input too", async () => {
    expect(await setExtraStamped(1.5, true)).toEqual(FAILED);
    expect(await setExtraStamped(7, "yes" as unknown as boolean)).toEqual(FAILED);
    expect(warnLog.mock.calls).toEqual([
      ["[stamp-action] invalid input action=setExtraStamped"],
      ["[stamp-action] invalid input action=setExtraStamped"],
    ]);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("AC-3: a missing session is expected and not logged", async () => {
    useClient(fakeSupabase({ user: null, checkpoints: KOSZEG }));
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual({ ok: false, reason: "unauthorized" });
    expect(await setExtraStamped(7, true)).toEqual({ ok: false, reason: "unauthorized" });
    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
  });

  it("AC-4: the client gets the same result whether or not the failure is logged", async () => {
    useClient(fakeSupabase({ checkpoints: KOSZEG, writeError: dbError("boom") }));
    const result = await setPlacesStamped(["OKTPH_03"], true);
    expect(result).toEqual(FAILED);
    expect(Object.keys(result).sort()).toEqual(["ok", "reason"]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
