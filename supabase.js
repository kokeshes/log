// supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

let _supabase = null;

// ---- fetch wrapper ----
function isAbortError(e){
  return e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted");
}

async function safeFetch(url, options = {}){
  const { signal, ...rest } = options || {};
  if (rest.keepalive === undefined) rest.keepalive = true;

  let lastErr = null;
  for (let i = 0; i < 2; i++){
    try{
      return await fetch(url, rest);
    }catch(e){
      lastErr = e;
      if (!isAbortError(e)) throw e;
      await new Promise(r => setTimeout(r, 200 + i * 250));
    }
  }
  throw lastErr;
}

// ---- refresh control (429対策) ----
let _refreshing = null;         // in-flight promise
let _cooldownUntil = 0;         // ms epoch
let _lastRefreshAt = 0;

async function refreshWithLock(sb){
  const now = Date.now();
  if (now < _cooldownUntil) return { data: null, error: null, skipped: true };

  // 連打防止（最低15秒空ける）
  if (now - _lastRefreshAt < 15000) return { data: null, error: null, skipped: true };

  if (_refreshing) return _refreshing;

  _refreshing = (async () => {
    try{
      _lastRefreshAt = Date.now();
      const { data, error } = await sb.auth.refreshSession();

      // 429っぽいときはクールダウン（60秒）
      if (error && String(error?.status || "").includes("429")){
        _cooldownUntil = Date.now() + 60000;
      }
      return { data, error, skipped: false };
    } finally {
      _refreshing = null;
    }
  })();

  return _refreshing;
}

export function getSupabase(){
  if (_supabase) return _supabase;

  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,     // ★重要：自動更新を止める
      detectSessionInUrl: false,
    },
    global: { fetch: safeFetch },
  });

  // 外から使えるように隠しで持たせる（app.jsから呼ぶ用）
  _supabase.__refreshWithLock = () => refreshWithLock(_supabase);

  return _supabase;
}

export function resetSupabase(){
  _supabase = null;
}
