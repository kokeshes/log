// log/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

let _supabase = null;

function isAbortError(e){
  return e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted");
}

// AbortError を少しだけ自動リトライ（PCでもiOSでも効く）
// - Supabase 内部が signal を付けて abort するケースがあり、Safari だと refresh 失敗→SIGNED_OUT っぽく見えることがある
async function safeFetch(url, options = {}){
  // signal を「完全に削除」する
  const { signal, ...rest } = options || {};

  // keepalive は POST などで効くことがある（GETでも害はほぼ無い）
  if (rest.keepalive === undefined) rest.keepalive = true;

  let lastErr = null;
  for (let i = 0; i < 2; i++){
    try{
      return await fetch(url, rest);
    }catch(e){
      lastErr = e;
      if (!isAbortError(e)) throw e;
      // 少し待って再試行
      await new Promise(r => setTimeout(r, 200 + i * 250));
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
    },
    global: {
      fetch: safeFetch
    }
  });

  return _supabase;
}

export function resetSupabase(){
  _supabase = null;
}
