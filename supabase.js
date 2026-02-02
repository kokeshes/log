// docs/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
const SUPABASE_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

// ✅ 重要：このファイルで「一度だけ」作って export する（再生成禁止）
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
