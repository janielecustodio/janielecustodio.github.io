import { supabase } from "./supabaseClient.js";

// Caches a looked-up food into the local `foods` table if it isn't already
// there (USDA/Open Food Facts hits), or returns the existing row's id
// (TACO/TBCA hits are already cached). Upsert on (source, source_id) means
// re-searching the same item just refreshes synced_at instead of duplicating.
async function ensureFoodCached(food) {
  if (food.cached && food.id) return food.id;

  const { data, error } = await supabase
    .from("foods")
    .upsert(
      {
        source: food.source,
        source_id: food.source_id,
        name: food.name,
        brand: food.brand,
        barcode: food.barcode,
        kcal_100g: food.kcal_100g,
        protein_100g: food.protein_100g,
        fat_100g: food.fat_100g,
        carbs_100g: food.carbs_100g,
        fiber_100g: food.fiber_100g,
        micros: food.micros || {},
        synced_at: new Date().toISOString(),
      },
      { onConflict: "source,source_id" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function addEntry(food, quantityG, loggedAt, mealType) {
  const foodId = await ensureFoodCached(food);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const mult = quantityG / 100;

  const { error } = await supabase.from("food_logs").insert({
    user_id: user.id,
    food_id: foodId,
    logged_at: loggedAt.toISOString(),
    meal_type: mealType,
    quantity_g: quantityG,
    kcal: food.kcal_100g * mult,
    protein_g: food.protein_100g * mult,
    fat_g: food.fat_100g * mult,
    carbs_g: food.carbs_100g * mult,
    fiber_g: (food.fiber_100g || 0) * mult,
    micros: food.micros || {},
  });
  if (error) throw error;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from("food_logs").delete().eq("id", id);
  if (error) throw error;
}

// `date` is a Date at local midnight for the day to fetch.
export async function getEntriesForDate(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await supabase
    .from("food_logs")
    .select("*, foods(name, source)")
    .gte("logged_at", start.toISOString())
    .lt("logged_at", end.toISOString())
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
