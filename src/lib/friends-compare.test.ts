import { describe, expect, it, vi } from "vitest";
import type { Checkpoint } from "./progress";

// Three places 10 km apart, one checkpoint (id = km + 1) per place, with coordinates.
const checkpoints: Checkpoint[] = [0, 10, 20].map((km, i) => ({
  id: km + 1,
  seq: i + 1,
  stage: 1,
  stage_seq: i + 1,
  code: `P${i}`,
  place_key: `P${i}`,
  name: `Place ${i}`,
  description: null,
  lat: 47 + i,
  lng: 16,
  km_from_start: km,
}));

vi.mock("./dashboard-data", () => ({ getReferenceData: async () => ({ checkpoints, extras: [] }) }));

import { compareWithFriend, type Friend } from "./friends";

// Records everything the code asks the database for.
function recordingSupabase(ownStamps: { checkpoint_id: number; stamped_on: string }[]) {
  const calls: string[] = [];
  const supabase = {
    from: (table: string) => ({
      select: (columns: string) => {
        calls.push(`from(${table}).select(${columns})`);
        return Promise.resolve({ data: ownStamps });
      },
    }),
    rpc: (name: string) => {
      calls.push(`rpc(${name})`);
      return Promise.resolve({ data: [] });
    },
  };
  return { supabase: supabase as never, calls };
}

const friend: Friend = {
  id: "f1",
  displayName: "Ana",
  isSharing: true,
  friendIsSharing: true,
  status: "accepted",
  isRequester: true,
  stampIds: [11, 21], // P1 and P2: ids are km + 1
};

describe("spec 0024: comparing with a friend", () => {
  it("AC-22: the friend's stamps come with the friend; the only thing read is the user's own stamps, nothing else of the friend", async () => {
    const { supabase, calls } = recordingSupabase([{ checkpoint_id: 1, stamped_on: "2026-05-01" }, { checkpoint_id: 11, stamped_on: "2026-05-02" }]);
    const { comparison } = await compareWithFriend(supabase, friend);
    expect(calls).toEqual(["from(user_stamps).select(checkpoint_id, stamped_on)"]);
    expect(comparison.places).toEqual({ both: 1, me: 1, them: 1, neither: 0 });
  });

  it("AC-22: the points of the map carry the place's state and no date, and one is drawn per variant with coordinates", async () => {
    const { supabase } = recordingSupabase([{ checkpoint_id: 1, stamped_on: "2026-05-01" }]);
    const { points } = await compareWithFriend(supabase, friend);
    expect(points.map((p) => [p.placeKey, p.who])).toEqual([["P0", "me"], ["P1", "them"], ["P2", "them"]]);
    for (const p of points) expect(Object.keys(p).sort()).toEqual(["lat", "lng", "name", "placeKey", "who"]);
  });
});
