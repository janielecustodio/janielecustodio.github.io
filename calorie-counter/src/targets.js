import { supabase } from "./supabaseClient.js";

// One settings row per user, not day-scoped — targets apply to every day
// until changed. Every field is nullable: unset means "don't show it,"
// not zero.
export async function getTargets() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("user_targets")
    .select("*")
    .eq("user_id", user.id)
    .limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}

export async function saveTargets({ kcal, protein_g, fat_g, carbs_g }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("user_targets").upsert(
    {
      user_id: user.id,
      kcal: kcal || null,
      protein_g: protein_g || null,
      fat_g: fat_g || null,
      carbs_g: carbs_g || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function clearTargets() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("user_targets").delete().eq("user_id", user.id);
  if (error) throw error;
}
