import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { logShareError } from "./log";
import { isShareToken, toShareCard, type ShareCard } from "./share-card";
import { createClient } from "./supabase/server";
import type { Database } from "./supabase/database.types";

// The table itself is closed to visitors. Once per request (React `cache`), so the page's metadata and its body share
// one lookup. A token that is no token, an unknown one and a failed lookup all give `null`: the caller answers 404
// and no one learns which it was.
export const loadShareCard = cache(async (token: string): Promise<ShareCard | null> => {
  if (!isShareToken(token)) return null;
  try {
    const { data, error } = await (await createClient()).rpc("get_share_card", { p_token: token });
    if (error) throw error;
    const row = data[0];
    return row ? toShareCard(row) : null;
  } catch (error) {
    logShareError("loadShareCard", error, "exception");
    return null;
  }
});

// A failed read is logged as a `read` (no Telegram message) and gives the empty list, which the panel shows as "no
// cards yet"; the user's next visit reads them again.
export async function loadOwnShareCards(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("share_cards")
    .select("id, token, created_at, display_name, percent, stamps_done, stamps_total")
    .order("created_at", { ascending: false });
  if (error) {
    logShareError("loadOwnShareCards", error, "read");
    return [];
  }
  return data;
}
