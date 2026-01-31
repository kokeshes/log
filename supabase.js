// docs/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ★ここをあなたのSupabaseに差し替え
export const SUPABASE_URL = "https://troequwqpdrpgadwfgbt.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_XDbKzADmUoR1NnEPIRl57w_iB7r088Q";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
