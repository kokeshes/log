// docs/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

// GitHub Pages (static) での「別個体」混線を避けるため固定
const STORAGE_KEY = "wired_sb_auth_v1";

let _supabase = null;

export function getSupabase() {
  if (_supabase) return _supabase;

  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: STORAGE_KEY,
      // デフォルト(localStorage)でOK。余計な差し替えは不安定化しやすい
    },
    // global.fetch は差し替えない（Abort/race/キャンセル不能化が起きうる）
  });

  return _supabase;
}

export function resetSupabase() {
  _supabase = null;
}
