import { supabase } from "../supabaseClient.js";

// TACO/TBCA have no live API — these rows are imported once into the
// `foods` table (see calorie-counter/SETUP.md). Results here are already
// cached, so they carry an `id` and never need upserting.
export async function searchTaco(query) {
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .in("source", ["taco", "tbca"])
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
    portions: [], // no household-unit data for TACO/TBCA, grams only
  }));
}
