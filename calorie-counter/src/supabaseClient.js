import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const isConfigured =
  !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_");

// createClient() throws synchronously on a malformed URL. Since this is a
// static import, that throw would abort the whole module graph — killing
// unrelated page chrome like the theme toggle — if config.js still has its
// placeholder values. Fall back to a syntactically valid dummy URL so the
// page stays alive; real calls just won't work until config.js is filled in.
export const supabase = createClient(
  isConfigured ? SUPABASE_URL : "https://placeholder.supabase.co",
  isConfigured ? SUPABASE_ANON_KEY : "placeholder-anon-key"
);
