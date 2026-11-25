import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { createLocalClient } from "./localClient.js";

export const isConfigured =
  !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_");

// Local mode (see localClient.js) — for using the app without a reachable
// Supabase account at all, e.g. while locked out. Entered/exited via the
// "Usar sem conta" link on the sign-in screen and the Sign out button
// (main.js); both just flip this flag and reload, since swapping the
// live `supabase` export mid-session isn't possible for a value every
// other module already imported by reference.
export const isLocalMode = (() => {
  try {
    return localStorage.getItem("jc_local_mode") === "1";
  } catch {
    return false;
  }
})();

// createClient() throws synchronously on a malformed URL. Since this is a
// static import, that throw would abort the whole module graph — killing
// unrelated page chrome like the theme toggle — if config.js still has its
// placeholder values. Fall back to a syntactically valid dummy URL so the
// page stays alive; real calls just won't work until config.js is filled in.
export const supabase = isLocalMode
  ? createLocalClient()
  : createClient(
      isConfigured ? SUPABASE_URL : "https://placeholder.supabase.co",
      isConfigured ? SUPABASE_ANON_KEY : "placeholder-anon-key"
    );
