import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getReferenceData } from "./dashboard-data";
import {
  buildPlaces,
  buildStages,
  progressSummary,
  stampedPlaceKeys,
  walkedRanges,
  type Checkpoint,
  type StageMeta,
} from "./progress";
import stagesData from "../../scripts/data/okt-stages.json";

export type Friend = {
  id: string;
  displayName: string | null;
  isSharing: boolean;
  friendIsSharing: boolean;
  status: "pending" | "accepted";
  isRequester: boolean;
  stampIds: number[]; // what the friend shares with me: empty while pending or switched off
};

// Everything the signed-in user `uid` has with other people: one row per friendship or pending request.
export async function getFriends(supabase: SupabaseClient<Database>, uid: string): Promise<Friend[]> {
  const [{ data: profiles }, { data: friendships }, { data: stamps }] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase.from("friendships").select("*"),
    supabase.rpc("get_friend_stamps"),
  ]);

  const names = new Map(profiles?.map((p) => [p.id, p.display_name]));
  const stampIds = new Map<string, number[]>();
  for (const s of stamps ?? []) stampIds.set(s.friend_id, [...(stampIds.get(s.friend_id) ?? []), s.checkpoint_id]);

  return (friendships ?? []).map((f) => {
    const isRequester = f.user_id === uid;
    const id = isRequester ? f.friend_id : f.user_id;
    return {
      id,
      displayName: names.get(id) ?? null,
      isSharing: isRequester ? f.user_is_sharing : f.friend_is_sharing,
      friendIsSharing: isRequester ? f.friend_is_sharing : f.user_is_sharing,
      status: f.status as Friend["status"],
      isRequester,
      stampIds: stampIds.get(id) ?? [],
    };
  });
}

// Spec 0024 AC-8: a friend's numbers come from the same functions as the owner's dashboard (progress.ts),
// computed from the stamped checkpoint ids. A stage is completed when all of its places are stamped.
export function summarizeFriend(checkpoints: Checkpoint[], checkpointIds: number[], stagesMeta: StageMeta[]) {
  const places = buildPlaces(checkpoints);
  const stampedKeys = stampedPlaceKeys(places, checkpointIds.map((id) => ({ checkpoint_id: id, stamped_on: "" })));
  const summary = progressSummary(places, walkedRanges(places, stampedKeys));
  const stages = buildStages(places, stagesMeta);
  const completedStages = stages.filter((s) => s.places.every((p) => stampedKeys.has(p.key))).length;
  return { summary, places, stages, stampedKeys, completedStages };
}

export async function getFriendProgress(friend: Friend) {
  const { checkpoints } = await getReferenceData();
  return summarizeFriend(checkpoints, friend.stampIds, stagesData.stages);
}
