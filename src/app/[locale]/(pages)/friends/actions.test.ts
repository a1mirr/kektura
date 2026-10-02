/* eslint-disable @typescript-eslint/no-explicit-any */
process.env.NEXT_PUBLIC_FF_FRIENDS = "1";
﻿import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendRequest, approveRequest, ignoreRequest, removeFriend, setSharing, regenerateInvite } from "./actions";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: any[]) => mockRevalidatePath(...args) }));

const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
    from: () => ({
      update: mockUpdate,
    })
  })
}));

describe("Friends Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("sendRequest handles success and known errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: "ok", error: null });
    let res = await sendRequest("abc");
    expect(res).toEqual({ ok: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/friends");

    mockRpc.mockResolvedValueOnce({ data: "unauthorized", error: null });
    res = await sendRequest("abc");
    expect(res).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("approveRequest revalidates on success", async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    const res = await approveRequest("u2");
    expect(res).toEqual({ ok: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/friends");
  });
});
