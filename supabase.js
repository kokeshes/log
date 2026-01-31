// docs/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

let _supabase = null;

export function getSupabase(){
  if (_supabase) return _supabase;

  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    },
    global: {
      // iOS PWAで「変なキャッシュ」に触れないようにする
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          cache: "no-store"
        });
      }
    }
  });

  return _supabase;
}

export function resetSupabase(){
  _supabase = null;
}
