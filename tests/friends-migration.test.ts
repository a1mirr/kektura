/* eslint-disable @typescript-eslint/no-explicit-any */
﻿import { describe, expect, it, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

let isSupabaseRunning = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    isSupabaseRunning = res.ok || res.status === 400 || res.status === 404;
  } catch {
    isSupabaseRunning = false;
  }
});

describe('spec 0024: friends migration RLS', () => {
  it('AC-x: anon cannot call RPCs', async (ctx) => {
    if (!isSupabaseRunning) return ctx.skip();
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const rpcs = [
      { name: 'send_request', args: { token: 'abc' } },
      { name: 'approve_request', args: { requester_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'ignore_request', args: { requester_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'remove_friend', args: { other_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'set_sharing', args: { other_id: '00000000-0000-0000-0000-000000000000', sharing: true } },
    ];
    for (const rpc of rpcs) {
      const { error } = await client.rpc(rpc.name as any, rpc.args);
      expect(error).not.toBeNull();
    }
  });
});
