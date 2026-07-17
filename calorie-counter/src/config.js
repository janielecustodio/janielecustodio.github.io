// Fill these in after following calorie-counter/SETUP.md.
// SUPABASE_ANON_KEY is safe to ship in client code — it only grants what
// Row Level Security policies (sql/schema.sql) allow, never full DB access.
export const SUPABASE_URL = "https://wrbwcppfxgyxjyffuptb.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_QQXybZ1Y1WwjqjWAa6OylQ_5WMkKyK5";

// Free key from https://fdc.nal.usda.gov/api-key-signup.html
//
// DO NOT commit your real key here — this file is served as plain client
// JS by GitHub Pages, and GitHub's secret scanning (and USDA's own) will
// find and revoke it within minutes of a push. Set it locally only; see
// SETUP.md for how to keep it out of git while still deploying it.
export const USDA_API_KEY = "REPLACE_WITH_YOUR_USDA_KEY";
