/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const CARD = "3f0c1b6e-9d41-4c55-8a39-2b7a5c1e9d02";

const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));
const mockFlagOn = vi.fn();
vi.mock("@/lib/feature-flags-server", () => ({ flagOn: (key: string) => mockFlagOn(key) }));
const mockReference = vi.fn();
vi.mock("@/lib/dashboard-data", () => ({ getReferenceData: () => mockReference() }));
const mockStamps = vi.fn();
const mockFrom = vi.fn(() => ({ select: () => mockStamps() }));

const checkpoint = (id: number, key: string, km: number) => ({
  id,
  seq: id,
  stage: 1,
  stage_seq: id,
  code: key,
  place_key: key,
  name: key,
  description: null,
  lat: 47,
  lng: 17,
  km_from_start: km,
  required_from: null,
  retired_on: null,
  replaced_by: null,
  after_place_key: null,
  position_approximate: false,
  moved_on: null,
});

// Fresh module per test: the rate limiter is module state.
async function load() {
  vi.resetModules();
  return import("./actions");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFlagOn.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockCreateClient.mockResolvedValue({ rpc: mockRpc, from: mockFrom, auth: { getUser: mockGetUser } });
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockRpc.mockResolvedValue({ data: "ok", error: null });
  mockReference.mockResolvedValue({ checkpoints: [checkpoint(1, "a", 0), checkpoint(2, "b", 10)] });
  mockStamps.mockResolvedValue({
    data: [
      { checkpoint_id: 1, stamped_on: "2026-05-01" },
      { checkpoint_id: 2, stamped_on: "2026-05-02" },
    ],
    error: null,
  });
});

describe("spec 0039: share card actions", () => {
  describe("AC-2, AC-3: creating", () => {
    it("freezes the numbers computed on the server from the user's own stamps and sends only the name choice from the client", async () => {
      const { createShareCard } = await load();
      expect(await createShareCard(true)).toEqual({ ok: true });
      expect(mockRpc).toHaveBeenCalledTimes(1);
      const [fn, args] = mockRpc.mock.calls[0];
      expect(fn).toBe("create_share_card");
      expect(args).toMatchObject({
        p_show_name: true,
        p_stamps_done: 2,
        p_stamps_total: 2,
        p_percent: 100,
        p_km_done: 10,
        p_km_left: 0,
        p_ranges: [[0, 10]],
      });
      expect(JSON.stringify(args)).not.toContain("2026");
    });

    it("anything but `true` is anonymous", async () => {
      const { createShareCard } = await load();
      await createShareCard("yes" as unknown as boolean);
      expect(mockRpc.mock.calls[0][1].p_show_name).toBe(false);
    });
  });

  describe("AC-12: refusals", () => {
    it("the database's limit comes back as `limit`, a signed-out caller as `unauthorized`", async () => {
      const { createShareCard } = await load();
      mockRpc.mockResolvedValueOnce({ data: "limit", error: null });
      expect(await createShareCard(false)).toEqual({ ok: false, reason: "limit" });
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      expect(await createShareCard(false)).toEqual({ ok: false, reason: "unauthorized" });
    });

    it("a user may create 20 cards an hour", async () => {
      const { createShareCard } = await load();
      for (let i = 0; i < 20; i++) expect(await createShareCard(false)).toEqual({ ok: true });
      expect(await createShareCard(false)).toEqual({ ok: false, reason: "failed" });
    });
  });

  describe("AC-1: the flag", () => {
    it("both actions answer `disabled` while the flag is off, without touching the session or the database", async () => {
      mockFlagOn.mockResolvedValue(false);
      const { createShareCard, deleteShareCard } = await load();
      expect(await createShareCard(false)).toEqual({ ok: false, reason: "disabled" });
      expect(await deleteShareCard(CARD)).toEqual({ ok: false, reason: "disabled" });
      expect(mockFlagOn).toHaveBeenCalledWith("share");
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("AC-6: deleting", () => {
    it("calls delete_share_card with the card's id", async () => {
      const { deleteShareCard } = await load();
      expect(await deleteShareCard(CARD)).toEqual({ ok: true });
      expect(mockRpc).toHaveBeenCalledWith("delete_share_card", { p_id: CARD });
    });

    it("refuses an id that is no uuid before asking the database", async () => {
      const { deleteShareCard } = await load();
      expect(await deleteShareCard("1; drop table share_cards")).toEqual({ ok: false, reason: "failed" });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("a signed-out caller is `unauthorized`", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const { deleteShareCard } = await load();
      expect(await deleteShareCard(CARD)).toEqual({ ok: false, reason: "unauthorized" });
    });
  });

  describe("AC-13: failures never throw", () => {
    it("a database error, an unexpected answer and a thrown error all come back as `failed`", async () => {
      const { createShareCard, deleteShareCard } = await load();
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "denied" } });
      expect(await createShareCard(false)).toEqual({ ok: false, reason: "failed" });
      mockRpc.mockResolvedValueOnce({ data: "invalid", error: null });
      expect(await createShareCard(false)).toEqual({ ok: false, reason: "failed" });
      mockRpc.mockRejectedValueOnce(new Error("network down"));
      expect(await deleteShareCard(CARD)).toEqual({ ok: false, reason: "failed" });
      mockReference.mockRejectedValueOnce(new Error("read failed"));
      expect(await createShareCard(false)).toEqual({ ok: false, reason: "failed" });
    });

    it("AC-10: a failed read of the stamps fails the action: no card is made from 'no stamps'", async () => {
      const { createShareCard } = await load();
      mockStamps.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
      expect(await createShareCard(true)).toEqual({ ok: false, reason: "failed" });
      expect(mockRpc).not.toHaveBeenCalled();
      expect(String((console.error as any).mock.calls[0][0])).toBe('[share] action=createShareCard code=57014 message="timeout"');
    });

    it("the log line holds the action and the error, no user id, token or name", async () => {
      const { createShareCard } = await load();
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "denied" } });
      await createShareCard(true);
      expect(String((console.error as any).mock.calls[0][0])).toBe('[share] action=createShareCard code=42501 message="denied"');
    });
  });
});
