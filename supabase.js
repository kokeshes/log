// supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

// Supabaseのセッション保存キーを固定（PWA/Safariで揺れた時の事故を減らす）
const STORAGE_KEY = "wiredlog-auth-v1";

let _supabase = null;

function isAbortError(e) {
  return e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted");
}

async function safeFetch(url, options = {}) {
  let lastErr = null;
  for (let i = 0; i < 2; i++) {
    try {
      return await fetch(url, {
        ...options,
        keepalive: options.keepalive ?? true,
      });
    } catch (e) {
      lastErr = e;
      if (!isAbortError(e)) throw e;
      await new Promise((r) => setTimeout(r, 200 + i * 250));
    }
  }
  throw lastErr;
}

export function getSupabase() {
  if (_supabase) return _supabase;

  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: STORAGE_KEY,
      storage: window.localStorage, // iOS PWAでの“妙な揺れ”対策として明示
    },
    global: {
      fetch: safeFetch,
    },
  });

  return _supabase;
}

export function resetSupabase() {
  _supabase = null;
}
