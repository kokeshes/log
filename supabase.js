// docs/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

// ★ storage key を固定（別ページ/別バージョン混在時の事故を減らす）
const STORAGE_KEY = "wired-sb-auth-v1";

let _supabase = null;

function isAbortError(e){
  return e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted");
}

// AbortErrorを軽くリトライ。signal は捨てる（supabase側が付けてくるケースがある）
async function safeFetch(url, options = {}){
  const { signal, ...rest } = options || {};
  if (rest.keepalive === undefined) rest.keepalive = true;

  let lastErr = null;
  for (let i = 0; i < 3; i++){
    try{
      return await fetch(url, rest);
    }catch(e){
      lastErr = e;
      if (!isAbortError(e)) throw e;
      await new Promise(r => setTimeout(r, 180 + i * 260));
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
      storageKey: STORAGE_KEY,
    },
    global: {
      fetch: safeFetch
    }
  });

  return _supabase;
}

// ★ resetSupabase は基本 “使わない” 方針に変える（多重clientの元）
// どうしても必要なら、必ずページリロード前提でのみ使う。
export function resetSupabaseHard(){
  _supabase = null;
}