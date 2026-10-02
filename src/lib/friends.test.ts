/* eslint-disable @typescript-eslint/no-explicit-any */
﻿import { describe, expect, it } from "vitest";
import { getFriends } from "./friends";

function fakeSupabase(uid: string, profiles: any[], friendships: any[], stamps: any[]) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: uid } } }) },
    from: (table: string) => ({
      select: (query: string) => {
        if (table === "profiles") return Promise.resolve({ data: profiles });
        if (table === "friendships") return Promise.resolve({ data: friendships });
        return Promise.resolve({ data: [] });
      }
    }),
    rpc: (name: string) => {
      if (name === "get_friend_stamps") return Promise.resolve({ data: stamps });
      return Promise.resolve({ data: [] });
    }
  } as any;
}

describe("getFriends", () => {
  it("maps data correctly and avoids N+1 by using rpc and simple selects", async () => {
    const sb = fakeSupabase(
      "u1",
      [{ id: "u2", display_name: "Bob" }, { id: "u3", display_name: "Charlie" }],
      [
        { user_id: "u1", friend_id: "u2", status: "accepted", friend_is_sharing: true, user_is_sharing: true },
        { user_id: "u3", friend_id: "u1", status: "pending", friend_is_sharing: true, user_is_sharing: false }
      ],
      [{ friend_id: "u2", checkpoint_id: 10 }]
    );

    const friends = await getFriends(sb);
    expect(friends).toHaveLength(2);
    
    const bob = friends.find(f => f.id === "u2")!;
    expect(bob.displayName).toBe("Bob");
    expect(bob.status).toBe("accepted");
    expect(bob.isRequester).toBe(true);
    expect(bob.isSharing).toBe(true);
    expect(bob.stamps).toEqual([{ checkpoint_id: 10 }]);

    const charlie = friends.find(f => f.id === "u3")!;
    expect(charlie.displayName).toBe("Charlie");
    expect(charlie.status).toBe("pending");
    expect(charlie.isRequester).toBe(false);
    expect(charlie.isSharing).toBe(false); 
    expect(charlie.stamps).toEqual([]);
  });
});
