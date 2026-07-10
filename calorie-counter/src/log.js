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

// `food.micros` holds per-100g values, same as kcal_100g/protein_100g/etc —
// scale them by the same quantity multiplier so the stored snapshot is the
// actual amount logged, not the per-100g reference value.
function scaleMicros(micros, mult) {
  const out = {};
  for (const [k, v] of Object.entries(micros || {})) {
    if (typeof v === "number") out[k] = v * mult;
  }
  return out;
}

// Combines several ingredients (each a normalized food + a gram amount)
// into one named `foods` row with per-serving macros baked into
// kcal_100g/etc, so it slots into food_logs exactly like any other food —
// "1 serving" = 100g is a fiction reused from the manual quick-add trick,
// never shown to the user (see recipes.js's portions array).
export async function saveRecipe(name, servings, ingredients) {
  const s = Math.max(Number(servings) || 1, 0.1);
  const totals = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 };
  const micros = {};
  for (const { food, grams } of ingredients) {
    const mult = grams / 100;
    totals.kcal += (food.kcal_100g || 0) * mult;
    totals.protein_g += (food.protein_100g || 0) * mult;
    totals.fat_g += (food.fat_100g || 0) * mult;
    totals.carbs_g += (food.carbs_100g || 0) * mult;
    totals.fiber_g += (food.fiber_100g || 0) * mult;
    for (const [k, v] of Object.entries(food.micros || {})) {
      if (typeof v === "number") micros[k] = (micros[k] || 0) + v * mult;
    }
  }
  const perServingMicros = {};
  for (const [k, v] of Object.entries(micros)) perServingMicros[k] = v / s;

  const recipe = {
    source: "recipe",
    source_id: crypto.randomUUID(),
    name,
    kcal_100g: totals.kcal / s,
    protein_100g: totals.protein_g / s,
    fat_100g: totals.fat_g / s,
    carbs_100g: totals.carbs_g / s,
    fiber_100g: totals.fiber_g / s,
    micros: perServingMicros,
    portions: [{ label: "1 serving", grams: 100 }],
  };

  const { data, error } = await supabase
    .from("foods")
    .upsert(
      {
        source: recipe.source,
        source_id: recipe.source_id,
        name: recipe.name,
        kcal_100g: recipe.kcal_100g,
        protein_100g: recipe.protein_100g,
        fat_100g: recipe.fat_100g,
        carbs_100g: recipe.carbs_100g,
        fiber_100g: recipe.fiber_100g,
        micros: recipe.micros,
        recipe_ingredients: ingredients.map(({ food, grams }) => ({
          name: food.name,
          source: food.source,
          source_id: food.source_id,
          grams,
        })),
        synced_at: new Date().toISOString(),
      },
      { onConflict: "source,source_id" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return { ...recipe, id: data.id, cached: true };
}

export async function addEntry(food, quantityG, loggedAt, mealType, quantityLabel) {
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
    quantity_label: quantityLabel || null,
    kcal: food.kcal_100g * mult,
    protein_g: food.protein_100g * mult,
    fat_g: food.fat_100g * mult,
    carbs_g: food.carbs_100g * mult,
    fiber_g: (food.fiber_100g || 0) * mult,
    micros: scaleMicros(food.micros, mult),
  });
  if (error) throw error;
}

// Edits quantity/time/meal on an existing entry in place — the food itself
// (food_id) doesn't change, so this never touches ensureFoodCached.
export async function updateEntry(id, food, quantityG, loggedAt, mealType, quantityLabel) {
  const mult = quantityG / 100;
  const { error } = await supabase
    .from("food_logs")
    .update({
      logged_at: loggedAt.toISOString(),
      meal_type: mealType,
      quantity_g: quantityG,
      quantity_label: quantityLabel || null,
      kcal: food.kcal_100g * mult,
      protein_g: food.protein_100g * mult,
      fat_g: food.fat_100g * mult,
      carbs_g: food.carbs_100g * mult,
      fiber_g: (food.fiber_100g || 0) * mult,
      micros: scaleMicros(food.micros, mult),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from("food_logs").delete().eq("id", id);
  if (error) throw error;
}

const FOODS_JOIN =
  "foods(name, source, source_id, kcal_100g, protein_100g, fat_100g, carbs_100g, fiber_100g, micros)";

// `date` is a Date at local midnight for the day to fetch.
export async function getEntriesForDate(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await supabase
    .from("food_logs")
    .select(`*, ${FOODS_JOIN}`)
    .gte("logged_at", start.toISOString())
    .lt("logged_at", end.toISOString())
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Most-logged foods for a meal type, newest-first among ties — powers the
// quick-pick chips shown when a meal is pinned via + Add. Aggregated
// client-side over recent history rather than a DB view, since this is a
// single-user app and a couple hundred rows is nothing to sort in JS.
export async function getFrequentFoodsForMeal(mealType, limit = 6) {
  const { data, error } = await supabase
    .from("food_logs")
    .select(`food_id, quantity_g, quantity_label, meal_type, logged_at, ${FOODS_JOIN}`)
    .eq("meal_type", mealType)
    .order("logged_at", { ascending: false })
    .limit(150);
  if (error) throw error;

  const byFood = new Map();
  for (const row of data || []) {
    if (!row.food_id) continue;
    const entry = byFood.get(row.food_id);
    if (entry) entry.count++;
    else byFood.set(row.food_id, { row, count: 1 });
  }
  return [...byFood.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => e.row);
}

// Duplicates one day's entries (optionally scoped to a single meal) into
// another day, keeping each entry's original time-of-day. Returns the
// number of entries copied.
export async function copyDay(fromDate, toDate, mealType) {
  const entries = await getEntriesForDate(fromDate);
  const filtered = mealType ? entries.filter((e) => e.meal_type === mealType) : entries;
  if (filtered.length === 0) return 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = filtered.map((e) => {
    const sourceTime = new Date(e.logged_at);
    const newTime = new Date(toDate);
    newTime.setHours(sourceTime.getHours(), sourceTime.getMinutes(), 0, 0);
    return {
      user_id: user.id,
      food_id: e.food_id,
      logged_at: newTime.toISOString(),
      meal_type: e.meal_type,
      quantity_g: e.quantity_g,
      quantity_label: e.quantity_label,
      kcal: e.kcal,
      protein_g: e.protein_g,
      fat_g: e.fat_g,
      carbs_g: e.carbs_g,
      fiber_g: e.fiber_g,
      micros: e.micros,
    };
  });
  const { error } = await supabase.from("food_logs").insert(rows);
  if (error) throw error;
  return rows.length;
}
