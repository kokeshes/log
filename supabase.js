// supabase.js
// Robust Supabase client for GitHub Pages PWA (/log/)
// - pins supabase-js v2 (ESM) for stability
// - uses a custom fetch that avoids AbortError-related flakiness on mobile
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

let _supabase = null;

function isAbortError(e){
  return e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted");
}

// AbortError を少しだけ自動リトライ（PCでもiOSでも効くことがある）
// 重要: signal は Supabase 内部が付けることがあるので「完全に削除」して再試行する
async function safeFetch(url, options = {}){
  const { signal, ...rest } = options || {};

  // keepalive は POST 等で効くことがある（GETでも害はほぼ無い）
  if (rest.keepalive === undefined) rest.keepalive = true;

  let lastErr = null;
  for (let i = 0; i < 2; i++){
    try{
      return await fetch(url, rest);
    }catch(e){
      lastErr = e;
      if (!isAbortError(e)) throw e;
      await new Promise(r => setTimeout(r, 250 + i * 350));
    }
  }
  throw lastErr;
}

export function getSupabase(){
  if (_supabase) return _supabase;

  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      // iOS(PWA)でもなるべく保持されるよう localStorage を明示
      storage: window.localStorage,
      storageKey: "wiredlog.auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    global: {
      fetch: safeFetch,
    },
  });

  return _supabase;
}

export function resetSupabase(){
  _supabase = null;
}
