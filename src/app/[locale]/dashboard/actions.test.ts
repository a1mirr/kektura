import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setExtraStampDate, setExtraStamped, setPlacesStamped, setStampDate } from "./actions";

type Call = { table: string; op: string; args: unknown[] };

// Minimal stand-in for the Supabase client: records every query-builder call and answers the
// checkpoint lookup from `checkpoints`.
function fakeSupabase({
  user = { id: "user-1" } as { id: string; email?: string } | null,
  checkpoints = [] as { id: number; place_key: string }[],
  readError = null as unknown,
  writeError = null as unknown,
  updatedRows = [{ ok: 1 }] as unknown[], // what `update(...).select()` returns: the rows that were changed
} = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    let result: { data?: unknown; error: unknown } = { error: null };
    let updating = false;
    const record = (op: string, args: unknown[]) => calls.push({ table, op, args });
    const q = {
      select(...args: unknown[]) {
        record("select", args);
        result = updating ? { data: updatedRows, error: writeError } : { data: checkpoints, error: readError };
        return q;
      },
      update(...args: unknown[]) {
        record("update", args);
        updating = true;
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

const writes = (calls: Call[]) => calls.filter((c) => c.op === "upsert" || c.op === "delete" || c.op === "update");

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

  it("spec 0016 AC-1: a date is the stamp date of NEW rows only: it still never overwrites an existing stamp", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG }));
    expect(await setPlacesStamped(["OKTPH_03"], true, "2026-10-02")).toEqual({ ok: true });
    expect(writes(calls)).toEqual([
      {
        table: "user_stamps",
        op: "upsert",
        args: [
          [
            { user_id: "user-1", checkpoint_id: 4, stamped_on: "2026-10-02" },
            { user_id: "user-1", checkpoint_id: 5, stamped_on: "2026-10-02" },
          ],
          { ignoreDuplicates: true },
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

  it("spec 0016 AC-1: a date is the stamp date of a NEW extra stamp only (ON CONFLICT DO NOTHING)", async () => {
    const { calls } = useClient(fakeSupabase());
    expect(await setExtraStamped(7, true, "2026-10-02")).toEqual({ ok: true });
    expect(writes(calls)).toEqual([
      {
        table: "user_extra_stamps",
        op: "upsert",
        args: [{ user_id: "user-1", extra_id: 7, stamped_on: "2026-10-02" }, { ignoreDuplicates: true }],
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

// A day inside the valid range whatever "today" is (the range runs from 1938 to tomorrow in UTC).
const DAY = "2026-09-15";

describe("spec 0016: dates of new stamps", () => {
  it("AC-3: a malformed date is invalid input: refused with a warning and no database access", async () => {
    for (const bad of ["2026-02-30", "2026-9-5", "", "tomorrow", " 2026-10-02"]) {
      expect(await setPlacesStamped(["OKTPH_03"], true, bad), bad).toEqual({ ok: false, reason: "failed" });
      expect(await setExtraStamped(7, true, bad), bad).toEqual({ ok: false, reason: "failed" });
    }
    expect(createClient).not.toHaveBeenCalled();
    expect(warnLog).toHaveBeenCalledTimes(10);
  });

  it("AC-3: a real date outside the valid range is ignored: the stamp is still made, with the default date", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG }));
    for (const outOfRange of ["2999-01-01", "0002-10-02", "1900-01-01"]) {
      expect(await setPlacesStamped(["OKTPH_03"], true, outOfRange)).toEqual({ ok: true });
    }
    const rows = writes(calls).map((c) => (c.args[0] as Record<string, unknown>[]).map((r) => "stamped_on" in r));
    expect(rows).toEqual([[false, false], [false, false], [false, false]]);
    expect(warnLog).not.toHaveBeenCalled();
  });

  it("AC-3: an out-of-range date doesn't stop an extra stamp either", async () => {
    const { calls } = useClient(fakeSupabase());
    expect(await setExtraStamped(7, true, "2999-01-01")).toEqual({ ok: true });
    expect(writes(calls)[0].args[0]).toEqual({ user_id: "user-1", extra_id: 7 });
  });

  it("AC-1: without a date nothing is added to the rows (the database default applies)", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG }));
    await setPlacesStamped(["OKTPH_03"], true);
    expect(writes(calls)[0].args[0]).toEqual([
      { user_id: "user-1", checkpoint_id: 4 },
      { user_id: "user-1", checkpoint_id: 5 },
    ]);
  });
});

describe("spec 0016: setStampDate", () => {
  it("AC-4: updates stamped_on of every variant of the place, for the user, and nothing else", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: [...KOSZEG, { id: 9, place_key: "OKTPH_07" }] }));
    expect(await setStampDate(["OKTPH_03"], DAY)).toEqual({ ok: true });
    expect(calls.filter((c) => c.table === "user_stamps")).toEqual([
      { table: "user_stamps", op: "update", args: [{ stamped_on: DAY }] },
      { table: "user_stamps", op: "eq", args: ["user_id", "user-1"] },
      { table: "user_stamps", op: "in", args: ["checkpoint_id", [4, 5]] },
      { table: "user_stamps", op: "select", args: ["checkpoint_id"] },
    ]);
    expect(calls.some((c) => c.op === "upsert" || c.op === "delete")).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/dashboard", "page");
  });

  it("AC-4: when the place isn't stamped (no row updated) it fails: it never creates a stamp", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG, updatedRows: [] }));
    expect(await setStampDate(["OKTPH_03"], DAY)).toEqual({ ok: false, reason: "failed" });
    expect(calls.some((c) => c.op === "upsert")).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled(); // a user error, not a failure of ours
  });

  it("AC-4: an unknown place fails without writing", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG }));
    expect(await setStampDate(["NOPE"], DAY)).toEqual({ ok: false, reason: "failed" });
    expect(writes(calls)).toEqual([]);
  });

  it("AC-4: an invalid or out-of-range date is refused without database access, with a warning", async () => {
    for (const bad of ["2026-02-30", "2999-01-01", "0002-10-02", "1937-12-31", "", "x"]) {
      expect(await setStampDate(["OKTPH_03"], bad), bad).toEqual({ ok: false, reason: "failed" });
    }
    expect(await setStampDate([], DAY)).toEqual({ ok: false, reason: "failed" });
    expect(await setStampDate("OKTPH_03" as unknown as string[], DAY)).toEqual({ ok: false, reason: "failed" });
    expect(createClient).not.toHaveBeenCalled();
    expect(warnLog.mock.calls.every((c) => c[0] === "[stamp-action] invalid input action=setStampDate")).toBe(true);
    expect(warnLog).toHaveBeenCalledTimes(8);
  });

  it("AC-4: without a session it is `unauthorized` and writes nothing", async () => {
    const { calls } = useClient(fakeSupabase({ user: null, checkpoints: KOSZEG }));
    expect(await setStampDate(["OKTPH_03"], DAY)).toEqual({ ok: false, reason: "unauthorized" });
    expect(writes(calls)).toEqual([]);
  });

  it("AC-4: a database error is `failed` and logged like the other stamp actions", async () => {
    useClient(fakeSupabase({ checkpoints: KOSZEG, writeError: { code: "42501", message: "denied", details: "secret" } }));
    expect(await setStampDate(["OKTPH_03"], DAY)).toEqual({ ok: false, reason: "failed" });
    expect(errorLog.mock.calls).toEqual([['[stamp-action] action=setStampDate stage=write user=user-1 code=42501 message="denied"']]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AC-4: never throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("cookies() unavailable"));
    await expect(setStampDate(["OKTPH_03"], DAY)).resolves.toEqual({ ok: false, reason: "failed" });
  });
});

describe("spec 0016: setExtraStampDate", () => {
  it("AC-4: updates only the user's own extra stamp", async () => {
    const { calls } = useClient(fakeSupabase());
    expect(await setExtraStampDate(7, DAY)).toEqual({ ok: true });
    expect(calls).toEqual([
      { table: "user_extra_stamps", op: "update", args: [{ stamped_on: DAY }] },
      { table: "user_extra_stamps", op: "eq", args: ["user_id", "user-1"] },
      { table: "user_extra_stamps", op: "eq", args: ["extra_id", 7] },
      { table: "user_extra_stamps", op: "select", args: ["extra_id"] },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/dashboard", "page");
  });

  it("AC-4: when the extra stamp isn't collected (no row updated) it fails without creating one", async () => {
    const { calls } = useClient(fakeSupabase({ updatedRows: [] }));
    expect(await setExtraStampDate(7, DAY)).toEqual({ ok: false, reason: "failed" });
    expect(calls.some((c) => c.op === "upsert")).toBe(false);
  });

  it("AC-4: refuses a non-integer id and an invalid date without database access", async () => {
    expect(await setExtraStampDate(1.5, DAY)).toEqual({ ok: false, reason: "failed" });
    expect(await setExtraStampDate(7, "2026-02-30")).toEqual({ ok: false, reason: "failed" });
    expect(await setExtraStampDate(7, "2999-01-01")).toEqual({ ok: false, reason: "failed" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("AC-4: without a session it is `unauthorized`; errors are `failed` and logged", async () => {
    useClient(fakeSupabase({ user: null }));
    expect(await setExtraStampDate(7, DAY)).toEqual({ ok: false, reason: "unauthorized" });
    useClient(fakeSupabase({ writeError: { code: "42501", message: "denied" } }));
    expect(await setExtraStampDate(7, DAY)).toEqual({ ok: false, reason: "failed" });
    expect(errorLog.mock.calls).toEqual([['[stamp-action] action=setExtraStampDate stage=write user=user-1 code=42501 message="denied"']]);
  });
});
