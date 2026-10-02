import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getReferenceData } from "./dashboard-data";
import { buildPlaces, stampedPlaceKeys, walkedRanges, progressSummary } from "./progress";

export type Friend = {
  id: string;
  displayName: string | null;
  isSharing: boolean;
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
    const isSharing = isRequester ? f.friend_is_sharing : f.user_is_sharing;
    
    result.push({
      id: friendId,
      displayName: profileMap.get(friendId) ?? null,
      isSharing,
      status: f.status as 'pending' | 'accepted',
      isRequester,
      stamps: stampsMap.get(friendId) ?? [],
    });
  }
  return result;
}

export async function getFriendProgress(friend: Friend) {
  const { checkpoints } = await getReferenceData();
  const places = buildPlaces(checkpoints);
  const stampedKeys = stampedPlaceKeys(places, (friend.stamps ?? []).map(s => ({ checkpoint_id: s.checkpoint_id, stamped_on: '2000-01-01' })));
  const ranges = walkedRanges(places, stampedKeys);
  const summary = progressSummary(places, ranges);
  return { summary, places, stampedKeys };
}

