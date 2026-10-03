/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: any[]) => mockRevalidatePath(...args) }));

const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

// Fresh module per test: the rate limiter is module state.
async function load() {
  vi.resetModules();
  return import("./actions");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FF_FRIENDS", "1");
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockCreateClient.mockResolvedValue({ rpc: mockRpc, auth: { getUser: mockGetUser } });
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe("spec 0024: friends actions", () => {
  it("AC-4: sendRequest reports each outcome the invite page needs", async () => {
    const { sendRequest } = await load();
    mockRpc.mockResolvedValueOnce({ data: "ok", error: null });
    expect(await sendRequest("abc")).toEqual({ ok: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/friends");
    for (const reason of ["invalid_token", "own_token", "already_friends", "already_pending"]) {
      mockRpc.mockResolvedValueOnce({ data: reason, error: null });
      expect(await sendRequest("abc")).toEqual({ ok: false, reason });
    }
    mockRpc.mockResolvedValueOnce({ data: "something new", error: null });
    expect(await sendRequest("abc")).toEqual({ ok: false, reason: "failed" });
  });

  it.each([
    ["approveRequest", ["u2"], "approve_request", { requester_id: "u2" }],
    ["ignoreRequest", ["u2"], "ignore_request", { requester_id: "u2" }],
    ["removeFriend", ["u2"], "remove_friend", { other_id: "u2" }],
    ["setSharing", ["u2", false], "set_sharing", { other_id: "u2", sharing: false }],
    ["regenerateInvite", [], "regenerate_invite", undefined],
    ["setDisplayName", ["Anna"], "set_display_name", { name: "Anna" }],
  ] as const)("AC-5, AC-9, AC-10: %s calls %s and revalidates", async (action, args, fn, rpcArgs) => {
    const actions = (await load()) as Record<string, (...a: unknown[]) => Promise<unknown>>;
    expect(await actions[action](...args)).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith(fn, ...(rpcArgs ? [rpcArgs] : []));
    expect(mockRevalidatePath).toHaveBeenCalledWith("/friends");
  });

  it("AC-14: a database error, a thrown error and a bad name all come back as `failed`, never thrown", async () => {
    const { approveRequest, sendRequest, setDisplayName, removeFriend } = await load();
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "boom" } });
    expect(await approveRequest("u2")).toEqual({ ok: false, reason: "failed" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();

    mockRpc.mockRejectedValueOnce(new Error("network down"));
    expect(await sendRequest("abc")).toEqual({ ok: false, reason: "failed" });
    mockGetUser.mockRejectedValueOnce(new Error("network down"));
    expect(await removeFriend("u2")).toEqual({ ok: false, reason: "failed" });
    mockCreateClient.mockRejectedValueOnce(new Error("no cookies"));
    expect(await removeFriend("u2")).toEqual({ ok: false, reason: "failed" });

    mockRpc.mockClear();
    for (const bad of ["", "   ", "x".repeat(41), "a\nb"]) {
      expect(await setDisplayName(bad)).toEqual({ ok: false, reason: "failed" });
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("AC-14: the log line holds the action and the error, no user id, token or name", async () => {
    const { sendRequest } = await load();
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "denied" } });
    await sendRequest("secret-token-123");
    const line = String((console.error as any).mock.calls[0][0]);
    expect(line).toBe('[friends] action=sendRequest code=42501 message="denied"');
  });

  it("AC-12: signed out, every action says `unauthorized` and touches nothing", async () => {
    const actions = (await load()) as Record<string, (...a: unknown[]) => Promise<unknown>>;
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const calls: [string, unknown[]][] = [
      ["sendRequest", ["abc"]],
      ["approveRequest", ["u2"]],
      ["ignoreRequest", ["u2"]],
      ["removeFriend", ["u2"]],
      ["setSharing", ["u2", true]],
      ["regenerateInvite", []],
      ["setDisplayName", ["Anna"]],
    ];
    for (const [name, args] of calls) expect(await actions[name](...args), name).toEqual({ ok: false, reason: "unauthorized" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("AC-15: with the flag off every action says `disabled` before it touches anything", async () => {
    vi.stubEnv("FF_FRIENDS", "");
    const actions = (await load()) as Record<string, (...a: unknown[]) => Promise<unknown>>;
    for (const name of ["sendRequest", "approveRequest", "ignoreRequest", "removeFriend", "setSharing", "regenerateInvite", "setDisplayName"]) {
      expect(await actions[name]("x", true), name).toEqual({ ok: false, reason: "disabled" });
    }
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("AC-15: the module exports only the actions (the flag check is not a callable server action)", async () => {
    const actions = await load();
    expect(Object.keys(actions).sort()).toEqual(
      ["approveRequest", "ignoreRequest", "regenerateInvite", "removeFriend", "sendRequest", "setDisplayName", "setSharing"],
    );
  });

  it("AC-13: invites, requests and approvals are limited per user; other users are not affected", async () => {
    const { sendRequest, approveRequest } = await load();
    mockRpc.mockResolvedValue({ data: "ok", error: null });
    for (let i = 0; i < 30; i++) expect(await sendRequest("abc")).toEqual({ ok: true });
    expect(await sendRequest("abc")).toEqual({ ok: false, reason: "failed" });
    expect(await approveRequest("u2")).toEqual({ ok: false, reason: "failed" });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u9" } } });
    expect(await sendRequest("abc")).toEqual({ ok: true });
  });
});
