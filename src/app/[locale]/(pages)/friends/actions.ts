'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logFriendsError } from '@/lib/log';
import type { ActionResult } from '@/lib/action-result';
import { createRateLimiter } from '@/lib/rate-limit';

type SendRequestResult = 
  | { ok: true } 
  | { ok: false; reason: 'unauthorized' | 'invalid_token' | 'own_token' | 'already_friends' | 'already_pending' | 'failed' | 'disabled' };

export async function isFriendsEnabled() {
  return process.env.NEXT_PUBLIC_FF_FRIENDS === '1';
}


const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });

export async function sendRequest(token: string): Promise<SendRequestResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { ok: false, reason: "unauthorized" };
  if (!rateLimiter.allow(uid)) return { ok: false, reason: "failed" };
  if (!(await isFriendsEnabled())) return { ok: false, reason: 'disabled' };
  const { data, error } = await supabase.rpc('send_request', { token });
  
  if (error) {
    logFriendsError('sendRequest', error);
    return { ok: false, reason: 'failed' };
  }
  
  if (data !== 'ok') {
    return { ok: false, reason: data as 'unauthorized' | 'invalid_token' | 'own_token' | 'already_friends' | 'already_pending' };
  }
  
  revalidatePath('/friends');
  return { ok: true };
}

export async function approveRequest(requesterId: string): Promise<ActionResult> {
  if (!(await isFriendsEnabled())) return { ok: false, reason: 'disabled' };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (uid && !rateLimiter.allow(uid)) return { ok: false, reason: "failed" };
  const { error } = await supabase.rpc('approve_request', { requester_id: requesterId });
  
  if (error) {
    logFriendsError('approveRequest', error);
    return { ok: false, reason: 'failed' };
  }
  
  revalidatePath('/friends');
  return { ok: true };
}

export async function ignoreRequest(requesterId: string): Promise<ActionResult> {
  if (!(await isFriendsEnabled())) return { ok: false, reason: 'disabled' };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (uid && !rateLimiter.allow(uid)) return { ok: false, reason: "failed" };
  const { error } = await supabase.rpc('ignore_request', { requester_id: requesterId });
  
  if (error) {
    logFriendsError('ignoreRequest', error);
    return { ok: false, reason: 'failed' };
  }
  
  revalidatePath('/friends');
  return { ok: true };
}

export async function removeFriend(friendId: string): Promise<ActionResult> {
  if (!(await isFriendsEnabled())) return { ok: false, reason: 'disabled' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_friend', { other_id: friendId });
  
  if (error) {
    logFriendsError('removeFriend', error);
    return { ok: false, reason: 'failed' };
  }
  
  revalidatePath('/friends');
  return { ok: true };
}

export async function setSharing(friendId: string, isSharing: boolean): Promise<ActionResult> {
  if (!(await isFriendsEnabled())) return { ok: false, reason: 'disabled' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_sharing', { other_id: friendId, sharing: isSharing });
  if (error) {
    logFriendsError('setSharing', error);
    return { ok: false, reason: 'failed' };
  }
  revalidatePath('/friends');
  return { ok: true };
}


export async function regenerateInvite(): Promise<ActionResult> {
  if (!(await isFriendsEnabled())) return { ok: false, reason: 'disabled' };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { ok: false, reason: 'unauthorized' };
  if (!rateLimiter.allow(uid)) return { ok: false, reason: 'failed' };
  const newToken = crypto.randomUUID();
  const { error } = await supabase.from('profiles').update({ invite_token: newToken }).eq('id', uid);
  if (error) { logFriendsError('regenerateInvite', error); return { ok: false, reason: 'failed' }; }
  revalidatePath('/friends');
  return { ok: true };
}



