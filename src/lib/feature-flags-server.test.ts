import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("./supabase/server", () => ({ createClient: () => mockCreateClient() }));
const mockConnection = vi.fn();
vi.mock("next/server", () => ({ connection: () => mockConnection() }));

const { flagOn } = await import("./feature-flags-server");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockConnection.mockResolvedValue(undefined);
  mockCreateClient.mockResolvedValue({ rpc: mockRpc });
});

describe("spec 0035: reading the flags on the server", () => {
  it("AC-4, AC-8: the answer comes from feature_flags_for_me() and is a plain boolean", async () => {
    mockRpc.mockResolvedValue({ data: [{ key: "friends", mode: "allowlist", listed: true }], error: null });
    expect(await flagOn("friends")).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("feature_flags_for_me");
    mockRpc.mockResolvedValue({ data: [{ key: "friends", mode: "allowlist", listed: false }], error: null });
    expect(await flagOn("friends")).toBe(false);
  });

  it("AC-4: it waits for a request first, and what that raises is not swallowed (no flag is baked into a prerendered page)", async () => {
    mockConnection.mockRejectedValue(new Error("prerendering stops here"));
    await expect(flagOn("friends")).rejects.toThrow("prerendering stops here");
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("AC-9: a database error gives the default, still answers, and logs one line without the details", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied", details: "user 123" } });
    expect(await flagOn("friends")).toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);
    const line = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(line).toBe('[feature-flags] lookup failed code=42501 message="permission denied"');
    expect(line).not.toContain("123");
  });

  it("AC-9: a thrown error, even while making the client, gives the default too", async () => {
    mockRpc.mockRejectedValue(new Error("network down"));
    expect(await flagOn("friends")).toBe(false);
    mockCreateClient.mockRejectedValue(new Error("no request"));
    expect(await flagOn("restaurants")).toBe(false);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
