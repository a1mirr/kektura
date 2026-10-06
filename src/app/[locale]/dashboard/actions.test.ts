import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setExtraStampDate, setExtraStamped, setPlacesStamped, setStampDate, setStampDates } from "./actions";

type Call = { table: string; op: string; args: unknown[] };

// Minimal stand-in for the Supabase client: records every query-builder call and answers the
// checkpoint lookup from `checkpoints`.
function fakeSupabase({
  user = { id: "user-1" } as { id: string; email?: string } | null,
  checkpoints = [] as { id: number; place_key: string; retired_on?: string | null }[],
  readError = null as unknown,
  writeError = null as unknown,
  updatedRows = [{ ok: 1 }] as unknown[], // what `update(...).select()` returns: the rows that were changed
  rpcResult = { data: true, error: null } as { data: unknown; error: unknown }, // what a database function answers
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
  const rpc = vi.fn(async (name: string, args: unknown) => {
    calls.push({ table: "rpc", op: name, args: [args] });
    return rpcResult;
  });
  const client = { auth: { getUser: vi.fn(async () => ({ data: { user } })) }, from, rpc };
  return { client, calls };
}

function useClient(fake: ReturnType<typeof fakeSupabase>) {
  vi.mocked(createClient).mockResolvedValue(fake.client as never);
  return fake;
}
const withClient = useClient; // helpers outside `it` callbacks must not look like hooks to the linter

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
    expect(refresh).toHaveBeenCalledOnce();
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
    expect(refresh).not.toHaveBeenCalled();
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
    expect(refresh).not.toHaveBeenCalled();
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
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("AC-4: when the place isn't stamped (no row updated) it fails: it never creates a stamp", async () => {
    const { calls } = useClient(fakeSupabase({ checkpoints: KOSZEG, updatedRows: [] }));
    expect(await setStampDate(["OKTPH_03"], DAY)).toEqual({ ok: false, reason: "failed" });
    expect(calls.some((c) => c.op === "upsert")).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
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
    expect(refresh).not.toHaveBeenCalled();
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
    expect(refresh).toHaveBeenCalledOnce();
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

// A retired stamp (Nyírjesi-erdészház, retired on 2014-11-21) is collected with a date before it retired and on its own.
const RETIRED = [{ id: 900, place_key: "OKT_RETIRED_NYIRJESI", retired_on: "2014-11-21" }];

describe("spec 0002: retired stamps", () => {
  const stampRetired = async (date: string | undefined, extra: typeof RETIRED = RETIRED, keys = ["OKT_RETIRED_NYIRJESI"]) => {
    const { calls } = withClient(fakeSupabase({ checkpoints: [...extra, { id: 4, place_key: "OKTPH_03" }] }));
    const result = await setPlacesStamped(keys, true, date);
    return { result, calls };
  };

  it("AC-17: a retired stamp is created with the date the user gave, when it is before it retired", async () => {
    const { result, calls } = await stampRetired("2014-11-20");
    expect(result).toEqual({ ok: true });
    expect(writes(calls)[0].args[0]).toEqual([{ user_id: "user-1", checkpoint_id: 900, stamped_on: "2014-11-20" }]);
    expect((await stampRetired("2013-06-01")).result).toEqual({ ok: true });
  });

  it("AC-17: a date on or after the retirement, or none, or one out of range, is refused without a write", async () => {
    for (const date of ["2014-11-21", "2014-11-22", "2026-10-05", undefined, "1900-01-01"]) {
      const { result, calls } = await stampRetired(date);
      expect(result, String(date)).toEqual({ ok: false, reason: "failed" });
      expect(writes(calls), String(date)).toEqual([]);
    }
    expect(refresh).not.toHaveBeenCalled();
    expect(warnLog).toHaveBeenCalled(); // a rejected input is logged without the input
  });

  it("AC-17: a request that mixes a retired stamp with another is refused as a whole", async () => {
    const { result, calls } = await stampRetired("2014-11-20", RETIRED, ["OKT_RETIRED_NYIRJESI", "OKTPH_03"]);
    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(writes(calls)).toEqual([]);
  });

  it("AC-17: taking a retired stamp away needs no date", async () => {
    const { calls } = withClient(fakeSupabase({ checkpoints: RETIRED }));
    expect(await setPlacesStamped(["OKT_RETIRED_NYIRJESI"], false)).toEqual({ ok: true });
    expect(writes(calls).map((c) => c.op)).toEqual(["delete"]);
  });

  it("AC-17: a current stamp is not affected: it keeps the default and the lenient date handling", async () => {
    const { calls } = withClient(fakeSupabase({ checkpoints: [{ id: 4, place_key: "OKTPH_03", retired_on: null }] }));
    expect(await setPlacesStamped(["OKTPH_03"], true)).toEqual({ ok: true });
    expect(writes(calls)).toHaveLength(1);
  });

  it("spec 0016 AC-13: changing the date of a retired stamp follows the same rule", async () => {
    const run = async (date: string, keys = ["OKT_RETIRED_NYIRJESI"]) => {
      const { calls } = withClient(fakeSupabase({ checkpoints: [...RETIRED, { id: 4, place_key: "OKTPH_03" }] }));
      return { result: await setStampDate(keys, date), calls };
    };
    expect((await run("2014-11-20")).result).toEqual({ ok: true });
    for (const date of ["2014-11-21", "2026-10-05"]) {
      const { result, calls } = await run(date);
      expect(result, date).toEqual({ ok: false, reason: "failed" });
      expect(writes(calls)).toEqual([]);
    }
    expect((await run("2014-11-20", ["OKT_RETIRED_NYIRJESI", "OKTPH_03"])).result).toEqual({ ok: false, reason: "failed" });
  });
});

describe("spec 0016: setStampDates (many dates at once)", () => {
  const FAILED = { ok: false, reason: "failed" };
  const rpcCalls = (calls: Call[]) => calls.filter((c) => c.table === "rpc");

  it("AC-17: sends the places, the extra stamps and the date to the one database function, and refreshes the page", async () => {
    const { calls } = useClient(fakeSupabase());
    expect(await setStampDates(["OKTPH_03", "OKTPH_07"], [7, 9], DAY)).toEqual({ ok: true });
    expect(calls).toEqual([
      { table: "rpc", op: "set_stamp_dates", args: [{ place_keys: ["OKTPH_03", "OKTPH_07"], extra_ids: [7, 9], new_date: DAY }] },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("AC-17: places alone and extra stamps alone are fine", async () => {
    const { calls } = useClient(fakeSupabase());
    expect(await setStampDates(["OKTPH_03"], [], DAY)).toEqual({ ok: true });
    expect(await setStampDates([], [7], DAY)).toEqual({ ok: true });
    expect(rpcCalls(calls)).toHaveLength(2);
  });

  it("AC-17: a request of exactly 500 items goes through, 501 does not", async () => {
    const { calls } = useClient(fakeSupabase());
    const places = Array.from({ length: 300 }, (_, i) => `K${i}`);
    const extras = Array.from({ length: 200 }, (_, i) => i);
    expect(await setStampDates(places, extras, DAY)).toEqual({ ok: true });
    expect(await setStampDates(places, [...extras, 200], DAY)).toEqual(FAILED);
    expect(rpcCalls(calls)).toHaveLength(1);
  });

  it.each([
    ["nothing at all", [[], [], DAY]],
    ["an invalid date", [["OKTPH_03"], [], "2026-02-30"]],
    ["a date after tomorrow", [["OKTPH_03"], [], "2999-01-01"]],
    ["a date before the first year of the trail", [["OKTPH_03"], [], "1937-12-31"]],
    ["an empty date", [["OKTPH_03"], [], ""]],
    ["another date format", [["OKTPH_03"], [], "2026-9-5"]],
    ["a place key that is not a string", [[42], [], DAY]],
    ["an over-long place key", [["x".repeat(65)], [], DAY]],
    ["an extra id that is not an integer", [[], [1.5], DAY]],
    ["an extra id that is not a number", [[], ["7"], DAY]],
    ["places that are not a list", ["OKTPH_03", [], DAY]],
    ["extras that are not a list", [["OKTPH_03"], 7, DAY]],
  ])("AC-17: refuses %s without database access, with one warning", async (_, args) => {
    expect(await setStampDates(...(args as [string[], number[], string]))).toEqual(FAILED);
    expect(createClient).not.toHaveBeenCalled();
    expect(warnLog.mock.calls).toEqual([["[stamp-action] invalid input action=setStampDates"]]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("AC-17: without a session it is `unauthorized` and calls nothing", async () => {
    const { calls } = useClient(fakeSupabase({ user: null }));
    expect(await setStampDates(["OKTPH_03"], [], DAY)).toEqual({ ok: false, reason: "unauthorized" });
    expect(calls).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("AC-17: when the function changed nothing (a stamp is gone, or a retired stamp's day) it is `failed`, nothing is refreshed, and it is no error of ours", async () => {
    useClient(fakeSupabase({ rpcResult: { data: false, error: null } }));
    expect(await setStampDates(["OKTPH_03"], [7], DAY)).toEqual(FAILED);
    expect(refresh).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog.mock.calls).toEqual([["[stamp-action] invalid input action=setStampDates"]]);
  });

  it("AC-17: a database error is `failed` and logged like the other stamp actions, without details or input", async () => {
    useClient(fakeSupabase({ rpcResult: { data: null, error: dbError("permission denied for function set_stamp_dates") } }));
    expect(await setStampDates(["OKTPH_03"], [7], DAY)).toEqual(FAILED);
    expect(errorLog.mock.calls).toEqual([
      ['[stamp-action] action=setStampDates stage=write user=user-1 code=42501 message="permission denied for function set_stamp_dates"'],
    ]);
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain("secret-details");
    expect(logged).not.toContain("OKTPH_03");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("AC-17: never throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("cookies() unavailable"));
    await expect(setStampDates(["OKTPH_03"], [], DAY)).resolves.toEqual(FAILED);
    const broken = fakeSupabase();
    broken.client.rpc = vi.fn(async () => {
      throw new Error("socket hang up");
    });
    useClient(broken);
    await expect(setStampDates(["OKTPH_03"], [], DAY)).resolves.toEqual(FAILED);
  });
});
