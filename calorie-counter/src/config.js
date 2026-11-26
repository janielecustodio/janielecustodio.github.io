// Fill these in after following calorie-counter/SETUP.md.
// SUPABASE_ANON_KEY is safe to ship in client code — it only grants what
// Row Level Security policies (sql/schema.sql) allow, never full DB access.
export const SUPABASE_URL = "https://wrbwcppfxgyxjyffuptb.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_QQXybZ1Y1WwjqjWAa6OylQ_5WMkKyK5";

// There is no USDA_API_KEY here on purpose — it lives server-side as a
// Supabase secret, read by the "usda-proxy" Edge Function
// (supabase/functions/usda-proxy) instead of being shipped in this file.
// See SETUP.md section 2 for why and how to set it up.
