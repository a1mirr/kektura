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
  status: 'pending' | 'accepted';
  isRequester: boolean;
  stamps?: { checkpoint_id: number }[];
};

export async function getFriends(supabase: SupabaseClient<Database>): Promise<Friend[]> {
  const [{ data: userRes }, { data: profiles }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('id, display_name')
  ]);
  const uid = userRes.user?.id;
  if (!uid) return [];

  const { data: friendships } = await supabase.from('friendships').select('*');
  if (!friendships) return [];

  const { data: stamps } = await supabase.rpc('get_friend_stamps');

  const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) ?? []);
  const stampsMap = new Map<string, { checkpoint_id: number }[]>();
  
  if (stamps) {
    for (const s of stamps) {
      if (!stampsMap.has(s.friend_id)) stampsMap.set(s.friend_id, []);
      stampsMap.get(s.friend_id)!.push({ checkpoint_id: s.checkpoint_id });
    }
  }

  const result: Friend[] = [];
  for (const f of friendships) {
    const isRequester = f.user_id === uid;
    const friendId = isRequester ? f.friend_id : f.user_id;
    const isSharing = isRequester ? f.user_is_sharing : f.friend_is_sharing;
    const friendIsSharing = isRequester ? f.friend_is_sharing : f.user_is_sharing;
    
    result.push({
      id: friendId,
      displayName: profileMap.get(friendId) ?? null,
      isSharing,
      friendIsSharing,
      status: f.status as 'pending' | 'accepted',
      isRequester,
      stamps: stampsMap.get(friendId) ?? [],
    });
  }
  return result;
}

// Spec 0024 AC-8: a friend's numbers come from the same functions as the owner's dashboard (progress.ts),
// computed from the stamped checkpoint ids. A stage is completed when all of its places are stamped.
export function summarizeFriend(checkpoints: Checkpoint[], checkpointIds: number[], stagesMeta: StageMeta[]) {
  const places = buildPlaces(checkpoints);
  const stampedKeys = stampedPlaceKeys(places, checkpointIds.map((id) => ({ checkpoint_id: id, stamped_on: "" })));
  const summary = progressSummary(places, walkedRanges(places, stampedKeys));
  const stages = buildStages(places, stagesMeta);
  const completedStages = stages.filter((s) => s.places.every((p) => stampedKeys.has(p.key))).length;
  return { summary, places, stampedKeys, completedStages };
}

export async function getFriendProgress(friend: Friend) {
  const { checkpoints } = await getReferenceData();
  return summarizeFriend(checkpoints, (friend.stamps ?? []).map((s) => s.checkpoint_id), stagesData.stages);
}
