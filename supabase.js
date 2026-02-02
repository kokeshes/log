// docs/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

// ★ セッション保持を安定させる（iOS PWA / PC 両方）
const STORAGE_KEY = "wired_auth_v1";

let _supabase = null;

function isAbortError(e){
  return e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted");
}

// AbortError を「軽く」リトライ（signalは消さない）
async function safeFetch(input, init){
  let lastErr = null;

  for (let i = 0; i < 2; i++){
    try{
      // initはそのまま渡す（signalも含む）
      return await fetch(input, init);
    }catch(e){
      lastErr = e;
      if (!isAbortError(e)) throw e;
      // 少し待って再試行
      await new Promise(r => setTimeout(r, 220 + i * 260));
    }
  }
  throw lastErr;
}

export function getSupabase(){
  if (_supabase) return _supabase;

  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.localStorage,
      storageKey: STORAGE_KEY,
    },
    global: {
      fetch: safeFetch,
    },
  });

  return _supabase;
}

// 互換のため残すが「作り直し」はしない（重要）
export function resetSupabase(){
  // NO-OP
}
