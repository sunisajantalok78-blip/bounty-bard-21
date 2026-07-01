// Server-only client for the USER'S own Supabase project (elyfytgzhuaogcfdzkqe).
// Reads keys from USER_SUPABASE_* secrets so we don't touch the Lovable Cloud
// integration files. Import inside handlers only — never at module scope of a
// client-reachable file.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getUserSupabase(): SupabaseClient | null {
  const url = process.env.USER_SUPABASE_URL;
  const key = process.env.USER_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (_client) return _client;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  return _client;
}

export function isUserSupabaseConfigured() {
  return Boolean(process.env.USER_SUPABASE_URL && process.env.USER_SUPABASE_SERVICE_ROLE_KEY);
}
