import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

let _supabase = null;

export function getSupabase(){
  if (!_supabase){
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      global: {
        fetch: (url, options = {}) => {
          // Abortされたら必ず new fetch にする
          return fetch(url, {
            ...options,
            signal: undefined
          });
        }
      }
    });
  }
  return _supabase;
}

// 重要：abort後に強制再生成するため
export function resetSupabase(){
  _supabase = null;
}
