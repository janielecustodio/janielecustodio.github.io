import { supabase } from "../supabaseClient.js";

// Recipes live in the same `foods` cache table as everything else
// (source = 'recipe'), created via the "Create a recipe" flow in
// main.js/log.js. Search just looks them up by name like TACO/TBCA.
export async function searchRecipes(query) {
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .eq("source", "recipe")
    .ilike("name", `%${query}%`)
    .limit(15);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    cached: true,
    source: row.source,
    source_id: row.source_id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    kcal_100g: row.kcal_100g,
    protein_100g: row.protein_100g,
    fat_100g: row.fat_100g,
    carbs_100g: row.carbs_100g,
    fiber_100g: row.fiber_100g,
    micros: row.micros || {},
    // Recipes are logged by the serving, not by weight — a single
    // "1 serving" = 100g portion reuses the existing amount/unit picker
    // instead of forcing per-100g math on something that has no natural
    // gram unit.
    portions: [{ label: "1 serving", grams: 100 }],
  }));
}
