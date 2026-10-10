/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { getFriends, summarizeFriend } from "./friends";
import { messageFiles } from "../../tests/message-files";
import { FRIEND_NOTICES, friendsPath, isUuid, isValidDisplayName } from "./friends-input";
import { buildPlaces, progressSummary, stampedPlaceKeys, walkedRanges, type Checkpoint, type StageMeta } from "./progress";

const languages = Object.values(messageFiles) as (typeof import("../../messages/en.json"))[];

function fakeSupabase(profiles: any[], friendships: any[], stamps: any[], waived: any[] = []) {
  return {
    from: (table: string) => ({
      select: () => Promise.resolve({ data: table === "profiles" ? profiles : friendships }),
    }),
    rpc: (name: string) =>
      Promise.resolve({ data: name === "get_friend_stamps" ? stamps : name === "get_friend_waived_places" ? waived : [] }),
  } as any;
}

const checkpoints: Checkpoint[] = [0, 10, 20, 30].map((km, i) => ({
  id: km + 1,
  seq: i + 1,
  stage: i < 2 ? 1 : 2,
  stage_seq: (i % 2) + 1,
  code: `P${i}`,
  place_key: `P${i}`,
  name: `P${i}`,
  description: null,
  lat: 47,
  lng: 16,
  km_from_start: km,
  required_from: null,
  retired_on: null,
  replaced_by: null,
  after_place_key: null,
  position_approximate: false,
  moved_on: null,
}));
const stagesMeta: StageMeta[] = [
  { stage: 1, start: "A", end: "B", km: 10 },
  { stage: 2, start: "B", end: "C", km: 10 },
];

describe("spec 0024: friends list", () => {
  const friendships = [
    { user_id: "u1", friend_id: "u2", status: "accepted", user_is_sharing: true, friend_is_sharing: false },
    { user_id: "u3", friend_id: "u1", status: "pending", user_is_sharing: true, friend_is_sharing: true },
  ];
  const profiles = [
    { id: "u2", display_name: "Bob" },
    { id: "u3", display_name: "Charlie" },
  ];

  it("AC-9: the two sharing switches are read from the right side of each row", async () => {
    const friends = await getFriends(fakeSupabase(profiles, friendships, []), "u1");
    const bob = friends.find((f) => f.id === "u2")!;
    expect(bob).toMatchObject({ displayName: "Bob", status: "accepted", isRequester: true, isSharing: true, friendIsSharing: false });
    const asBob = (await getFriends(fakeSupabase(profiles, friendships, []), "u2")).find((f) => f.id === "u1")!;
    expect(asBob).toMatchObject({ isRequester: false, isSharing: false, friendIsSharing: true });
  });

  it("AC-4: a request someone else sent to me is pending and not mine", async () => {
    const charlie = (await getFriends(fakeSupabase(profiles, friendships, []), "u1")).find((f) => f.id === "u3")!;
    expect(charlie).toMatchObject({ displayName: "Charlie", status: "pending", isRequester: false });
  });

  it("AC-7: the stamps of each friend come from get_friend_stamps only", async () => {
    const stamps = [{ friend_id: "u2", checkpoint_id: 10 }, { friend_id: "u2", checkpoint_id: 11 }];
    const friends = await getFriends(fakeSupabase(profiles, friendships, stamps), "u1");
    expect(friends.find((f) => f.id === "u2")!.stampIds).toEqual([10, 11]);
    expect(friends.find((f) => f.id === "u3")!.stampIds).toEqual([]);
  });

  it("AC-25: the places a friend was not missing come from get_friend_waived_places, place keys only, no dates", async () => {
    const waived = [{ friend_id: "u2", place_key: "P1" }, { friend_id: "u2", place_key: "P3" }];
    const friends = await getFriends(fakeSupabase(profiles, friendships, [], waived), "u1");
    expect(friends.find((f) => f.id === "u2")!.waivedKeys).toEqual(["P1", "P3"]);
    expect(friends.find((f) => f.id === "u3")!.waivedKeys).toEqual([]);
    expect(Object.keys(friends[0]).sort()).toEqual(
      ["displayName", "friendIsSharing", "id", "isRequester", "isSharing", "stampIds", "status", "waivedKeys"].sort(),
    );
  });

  it("AC-1: a display name is 1 to 40 characters without control characters", () => {
    expect(isValidDisplayName("Anna")).toBe(true);
    expect(isValidDisplayName("  Anna  ")).toBe(true);
    expect(isValidDisplayName("x".repeat(40))).toBe(true);
    for (const bad of ["", "   ", "x".repeat(41), "a\nb", "a\u0007b"]) expect(isValidDisplayName(bad)).toBe(false);
  });

  it("AC-14: only a well-formed user id is passed on to the database", () => {
    expect(isUuid("3f0c1b6e-9d41-4c55-8a39-2b7a5c1e9d00")).toBe(true);
    for (const bad of ["", "abc", "3f0c1b6e9d414c558a392b7a5c1e9d00", "3f0c1b6e-9d41-4c55-8a39-2b7a5c1e9d0z", "x' or 1=1 --"]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});

describe("spec 0024: a friend's numbers", () => {
  it("AC-8: equal the dashboard's functions applied to the same stamps", () => {
    const ids = [1, 11, 31];
    const places = buildPlaces(checkpoints);
    const stamped = stampedPlaceKeys(places, ids.map((id) => ({ checkpoint_id: id, stamped_on: "2026-01-01" })));
    const dashboard = progressSummary(places, walkedRanges(places, stamped));

    const friend = summarizeFriend(checkpoints, ids, stagesMeta);
    expect(friend.summary).toEqual(dashboard);
    expect([...friend.stampedKeys.keys()]).toEqual([...stamped.keys()]);
    expect(friend.summary.doneKm).toBe(10);
  });

  it("AC-7: a stage counts as completed only when all of its places are stamped", () => {
    expect(summarizeFriend(checkpoints, [], stagesMeta).completedStages).toBe(0);
    expect(summarizeFriend(checkpoints, [1], stagesMeta).completedStages).toBe(0);
    expect(summarizeFriend(checkpoints, [1, 11], stagesMeta).completedStages).toBe(1);
    expect(summarizeFriend(checkpoints, [1, 11, 21, 31], stagesMeta).completedStages).toBe(2);
    expect(summarizeFriend(checkpoints, [21, 31], stagesMeta).completedStages).toBe(1);
  });
});

describe("spec 0024: a friend's numbers with a place they were not missing", () => {
  // P0 (km 0), P1 (10), P2 (20), P3 (30); P2 is a new stamp the friend walked past before it was required.
  const withNew = checkpoints.map((c) => (c.place_key === "P2" ? { ...c, required_from: "2025-05-08" } : c));

  it("AC-25: the stretch runs across the waived place and the stage is complete, as on the friend's own dashboard", () => {
    const friend = summarizeFriend(withNew, [11, 31], stagesMeta, ["P2"]);
    expect(friend.summary.doneKm).toBe(20);
    expect(friend.completedStages).toBe(1); // stage 2 is P2 + P3
    expect([...friend.stampedKeys.keys()]).toEqual(["P1", "P3"]); // P2 is not a stamp: the count of stamps does not move
    expect([...friend.waived]).toEqual(["P2"]);
    const strict = summarizeFriend(withNew, [11, 31], stagesMeta);
    expect(strict.summary.doneKm).toBe(0);
    expect(strict.completedStages).toBe(0);
  });
});

describe("spec 0024: the answer of an action on the Friends page", () => {
  it("AC-18: a success goes back to the page with a notice, a failure with its reason", () => {
    expect(friendsPath({ ok: true }, "approved")).toBe("/friends?ok=approved");
    expect(friendsPath({ ok: false, reason: "failed" }, "approved")).toBe("/friends?error=failed");
  });

  it("AC-18: every notice has its message in every language, and the messages of the old `?sent=1` are gone", () => {
    for (const messages of languages) {
      for (const notice of FRIEND_NOTICES) expect(messages.friends[`ok_${notice}` as keyof typeof messages.friends]).toBeTruthy();
      expect("requestSent" in messages.friends).toBe(false);
    }
  });
});
