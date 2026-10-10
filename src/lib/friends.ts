import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { compareProgress } from "./compare";
import type { ComparePoint } from "./compare-map";
import { getReferenceData } from "./dashboard-data";
import { isRecentlyMoved, todayIso } from "./stamp-moves";
import {
  buildPlaces,
  buildStages,
  countDone,
  progressSummary,
  placeKeyOf,
  stampedPlaceKeys,
  waivedPlaceKeys,
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
  waivedKeys: string[]; // the places the friend was not missing when they walked past, never their dates
};

export async function getFriends(supabase: SupabaseClient<Database>, uid: string): Promise<Friend[]> {
  const [{ data: profiles }, { data: friendships }, { data: stamps }, { data: waived }] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase.from("friendships").select("*"),
    supabase.rpc("get_friend_stamps"),
    supabase.rpc("get_friend_waived_places"),
  ]);

  const names = new Map(profiles?.map((p) => [p.id, p.display_name]));
  const stampIds = new Map<string, number[]>();
  for (const s of stamps ?? []) stampIds.set(s.friend_id, [...(stampIds.get(s.friend_id) ?? []), s.checkpoint_id]);
  const waivedKeys = new Map<string, string[]>();
  for (const w of waived ?? []) waivedKeys.set(w.friend_id, [...(waivedKeys.get(w.friend_id) ?? []), w.place_key]);

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
      waivedKeys: waivedKeys.get(id) ?? [],
    };
  });
}

export function summarizeFriend(checkpoints: Checkpoint[], checkpointIds: number[], stagesMeta: StageMeta[], waivedKeys: string[] = []) {
  const places = buildPlaces(checkpoints);
  const stampedKeys = stampedPlaceKeys(places, checkpointIds.map((id) => ({ checkpoint_id: id, stamped_on: "" })));
  const waived = new Set(waivedKeys);
  const summary = progressSummary(places, walkedRanges(places, stampedKeys, waived));
  const stages = buildStages(places, stagesMeta);
  const completedStages = stages.filter((s) => countDone(s.places, stampedKeys, waived) === s.places.length).length;
  return { summary, places, stages, stampedKeys, waived, completedStages };
}

export async function getFriendProgress(friend: Friend) {
  const { checkpoints } = await getReferenceData();
  return summarizeFriend(checkpoints, friend.stampIds, stagesData.stages, friend.waivedKeys);
}

// The only database read besides the friend's shared stamps is the user's own `user_stamps`, under RLS: nothing else
// of the friend is asked for.
export async function compareWithFriend(supabase: SupabaseClient<Database>, friend: Friend, today: string = todayIso()) {
  const [progress, { data: stamps }] = await Promise.all([
    getFriendProgress(friend),
    supabase.from("user_stamps").select("checkpoint_id, stamped_on"),
  ]);
  const mine = stampedPlaceKeys(progress.places, stamps ?? []);
  const comparison = compareProgress(progress.places, mine, progress.stampedKeys, progress.stages, {
    mine: waivedPlaceKeys(progress.places, mine),
    theirs: progress.waived,
  });
  const points: ComparePoint[] = progress.places.flatMap((p) =>
    p.variants
      .filter((v) => v.lat != null && v.lng != null)
      .map((v) => ({ placeKey: placeKeyOf(v), label: p.label, name: v.name, lat: Number(v.lat), lng: Number(v.lng), who: comparison.placeWho.get(p.key)!, moved: isRecentlyMoved(v.moved_on, today) })),
  );
  return { progress, comparison, points };
}
