import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { deleteAccountAction } from "./actions";

const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
afterEach(() => vi.clearAllMocks());

function useSupabase({
  user = { id: "user-1", email: "hiker@example.com" } as { id: string; email: string } | null,
  rpcError = null as unknown,
  signOutThrows = false,
} = {}) {
  const calls: string[] = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user } }),
      signOut: async () => {
        calls.push("signOut");
        if (signOutThrows) throw new Error("auth server gone");
        return { error: null };
      },
    },
    rpc: async (name: string) => {
      calls.push(`rpc:${name}`);
      return { error: rpcError };
    },
  };
  vi.mocked(createClient).mockResolvedValue(client as never);
  return calls;
}

describe("spec 0014: deleteAccountAction", () => {
  it("AC-9: deletes through the database function, then clears the session", async () => {
    const calls = useSupabase();
    expect(await deleteAccountAction()).toEqual({ ok: true });
    expect(calls).toEqual(["rpc:delete_user_account", "signOut"]);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("AC-11: without a signed-in user the result is `unauthorized` and nothing is called", async () => {
    const calls = useSupabase({ user: null });
    expect(await deleteAccountAction()).toEqual({ ok: false, reason: "unauthorized" });
    expect(calls).toEqual([]);
  });

  it("AC-13: a refused deletion is `failed`, logged once without the email, and the session is kept", async () => {
    const calls = useSupabase({ rpcError: { code: "42501", message: "permission denied", details: "secret-details" } });
    expect(await deleteAccountAction()).toEqual({ ok: false, reason: "failed" });
    expect(calls).toEqual(["rpc:delete_user_account"]);
    expect(errorLog.mock.calls).toEqual([['[account-delete] stage=rpc user=user-1 code=42501 message="permission denied"']]);
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/hiker@example\.com|secret-details/);
  });

  it("AC-13: an exception is `failed` and logged, never thrown", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("cookies() unavailable"));
    await expect(deleteAccountAction()).resolves.toEqual({ ok: false, reason: "failed" });
    expect(errorLog.mock.calls).toEqual([['[account-delete] stage=exception user=unknown code=- message="cookies() unavailable"']]);
  });

  it("AC-9: when only clearing the session fails, the account is still deleted: `ok`, with the failure logged", async () => {
    useSupabase({ signOutThrows: true });
    expect(await deleteAccountAction()).toEqual({ ok: true });
    expect(errorLog.mock.calls).toEqual([['[account-delete] stage=exception user=user-1 code=- message="auth server gone"']]);
  });
});
