// Spec 0007 AC-12: what a test that needs the local database does when there is none. The decision is a pure function of
// the state of the database and the environment, so none of this needs Docker.
import { describe, expect, it } from "vitest";
import { databaseRequired, decideDatabase, enforceDecision, NOT_RUNNING_MESSAGE } from "../e2e/local-db";

const ready = { reachable: true, missing: [] };
const down = { reachable: false, missing: [] };
const required = { REQUIRE_LOCAL_DB: "1" };

describe("spec 0007: database tests skip or fail", () => {
  describe("AC-12: the decision", () => {
    it("not required and not reachable: skip, saying how to start the database", () => {
      expect(decideDatabase(down, {})).toEqual({ action: "skip", reason: NOT_RUNNING_MESSAGE });
      expect(NOT_RUNNING_MESSAGE).toBe("the local Supabase is not running: `npm run testdb:start`");
    });

    it("required and not reachable: fail with that message", () => {
      expect(decideDatabase(down, required)).toEqual({ action: "fail", message: NOT_RUNNING_MESSAGE });
    });

    it("reachable: neither a skip nor a failure, required or not", () => {
      expect(decideDatabase(ready, {})).toEqual({ action: "run" });
      expect(decideDatabase(ready, required)).toEqual({ action: "run" });
    });

    it("a database without the schema a file expects is the same problem: skip when not required, fail when required", () => {
      const state = { reachable: true, missing: ["public.friendships", "public.profiles"] };
      expect(decideDatabase(state, {})).toMatchObject({ action: "skip", reason: expect.stringContaining("public.friendships, public.profiles") });
      const failure = decideDatabase(state, required);
      expect(failure).toMatchObject({ action: "fail", message: expect.stringContaining("lacks public.friendships, public.profiles") });
      expect(JSON.stringify(failure)).toContain("npm run testdb:reset");
    });

    it("the variable counts as set when it has a value other than empty, 0 or false", () => {
      expect(databaseRequired({})).toBe(false);
      expect(databaseRequired({ REQUIRE_LOCAL_DB: "" })).toBe(false);
      expect(databaseRequired({ REQUIRE_LOCAL_DB: "0" })).toBe(false);
      expect(databaseRequired({ REQUIRE_LOCAL_DB: "false" })).toBe(false);
      expect(databaseRequired({ REQUIRE_LOCAL_DB: "1" })).toBe(true);
      expect(databaseRequired({ REQUIRE_LOCAL_DB: "true" })).toBe(true);
    });

    it("the other environment, such as CI alone, does not make the database required", () => {
      expect(decideDatabase(down, { CI: "true" })).toMatchObject({ action: "skip" });
    });
  });

  describe("AC-12: what a test does with the decision", () => {
    const test = () => {
      const notes: (string | undefined)[] = [];
      return { notes, ctx: { skip: ((note?: string) => { notes.push(note); throw new Error("skipped"); }) as (note?: string) => never } };
    };

    it("skips the test with the reason", () => {
      const { ctx, notes } = test();
      expect(() => enforceDecision(ctx, decideDatabase(down, {}))).toThrow("skipped");
      expect(notes).toEqual([NOT_RUNNING_MESSAGE]);
    });

    it("fails the test with the message, and does not skip it", () => {
      const { ctx, notes } = test();
      expect(() => enforceDecision(ctx, decideDatabase(down, required))).toThrow(NOT_RUNNING_MESSAGE);
      expect(notes).toEqual([]);
    });

    it("lets the test run when the database is there", () => {
      const { ctx, notes } = test();
      expect(() => enforceDecision(ctx, decideDatabase(ready, required))).not.toThrow();
      expect(notes).toEqual([]);
    });
  });
});
