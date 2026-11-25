import { supabase } from "./supabaseClient.js";

// One settings row per user, not day-scoped — same pattern as
// targets.js. Powers the "Ciclo das sementes" slot's auto-selected tab.
export async function getCycleStartDate() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("cycle_settings")
    .select("cycle_start_date")
    .eq("user_id", user.id)
    .limit(1);
  if (error) throw error;
  return (data && data[0]?.cycle_start_date) || null;
}

export async function saveCycleStartDate(dateStr) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("cycle_settings").upsert(
    { user_id: user.id, cycle_start_date: dateStr, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}
