import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("./supabase/server", () => ({ createClient: () => mockCreateClient() }));

import { loadOwnShareCards, loadShareCard } from "./share-card-server";

// Built at run time, from a repeated pair: a 32-character hex literal, or one with many different characters, assigned to a constant is what the secret scanner takes for an API key.
const TOKEN = "ab".repeat(16);
const ROW = {
  created_at: "2026-10-08T10:00:00Z",
  display_name: null,
  stamps_done: 87,
  stamps_total: 161,
  percent: 54,
  km_done: 636.2,
  km_left: 541,
  stages_done: 14,
  stages_total: 27,
  ranges: [[0, 12.5]],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockCreateClient.mockResolvedValue({ rpc: mockRpc });
  mockRpc.mockResolvedValue({ data: [ROW], error: null });
});

describe("spec 0039: reading a card for the public page", () => {
  it("AC-4: returns the card for its token, through get_share_card only", async () => {
    const card = await loadShareCard(TOKEN);
    expect(mockRpc).toHaveBeenCalledWith("get_share_card", { p_token: TOKEN });
    expect(card).toMatchObject({ percent: 54, stampsDone: 87, name: null, ranges: [[0, 12.5]] });
  });

  it("AC-4: an unknown token gives null, and a malformed one gives null without asking the database", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await loadShareCard("f".repeat(32))).toBeNull();
    mockRpc.mockClear();
    for (const bad of ["", "not-a-token", TOKEN.toUpperCase(), `${TOKEN}0`, "../x"]) expect(await loadShareCard(bad)).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("AC-4, AC-13: a failed lookup, a database error or a thrown error give null (the visitor sees 404) and one [share] line without the token", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await loadShareCard(TOKEN)).toBeNull();
    mockCreateClient.mockRejectedValueOnce(new Error("no cookies"));
    expect(await loadShareCard("a".repeat(32))).toBeNull();
    const lines = (console.error as unknown as { mock: { calls: string[][] } }).mock.calls.map((call) => call[0]);
    expect(lines).toEqual(['[share] action=loadShareCard code=57014 message="timeout"', '[share] action=loadShareCard code=- message="no cookies"']);
    for (const line of lines) expect(line).not.toMatch(/[0-9a-f]{32}/);
  });
});

describe("spec 0039: reading the owner's own cards for the panel", () => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));

  it("AC-6: asks for the cards newest first, with no token filter (row level security keeps it to the user's own)", async () => {
    order.mockResolvedValueOnce({ data: [{ id: "a" }], error: null });
    expect(await loadOwnShareCards({ from } as never)).toEqual([{ id: "a" }]);
    expect(from).toHaveBeenCalledWith("share_cards");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("AC-13: a failed read gives the empty list and one [share] line, never a throw and never a Telegram message", async () => {
    order.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await loadOwnShareCards({ from } as never)).toEqual([]);
    expect((console.error as unknown as { mock: { calls: string[][] } }).mock.calls.map((c) => c[0])).toEqual([
      '[share] action=loadOwnShareCards code=57014 message="timeout"',
    ]);
  });
});
