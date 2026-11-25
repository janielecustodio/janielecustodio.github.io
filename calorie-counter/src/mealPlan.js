import { supabase } from "./supabaseClient.js";
import { addEntry, deleteEntry } from "./log.js";

// Fetches the whole plan (slots -> options -> items), already ordered.
// Shared reference data (see migrations/008_add_meal_plan.sql), not
// scoped to a date — the "is this item done today" state is derived
// separately by cross-referencing today's food_logs (see main.js), not
// stored here.
export async function getMealPlan() {
  const { data: slots, error: slotsErr } = await supabase
    .from("meal_plan_slots")
    .select("*")
    .order("order_index", { ascending: true });
  if (slotsErr) throw slotsErr;
  if (!slots?.length) return [];

  const { data: options, error: optsErr } = await supabase
    .from("meal_plan_options")
    .select("*")
    .in(
      "slot_id",
      slots.map((s) => s.id)
    )
    .order("option_number", { ascending: true });
  if (optsErr) throw optsErr;

  const { data: items, error: itemsErr } = await supabase
    .from("meal_plan_items")
    .select("*")
    .in(
      "option_id",
      (options || []).map((o) => o.id)
    )
    .order("order_index", { ascending: true });
  if (itemsErr) throw itemsErr;

  const itemsByOption = new Map();
  for (const item of items || []) {
    if (!itemsByOption.has(item.option_id)) itemsByOption.set(item.option_id, []);
    itemsByOption.get(item.option_id).push(item);
  }
  const optionsBySlot = new Map();
  for (const opt of options || []) {
    const withItems = { ...opt, items: itemsByOption.get(opt.id) || [] };
    if (!optionsBySlot.has(opt.slot_id)) optionsBySlot.set(opt.slot_id, []);
    optionsBySlot.get(opt.slot_id).push(withItems);
  }
  return slots.map((slot) => ({ ...slot, options: optionsBySlot.get(slot.id) || [] }));
}

// A meal plan item's quantity is fixed by the plan, not user-entered, so
// it's logged using the same "1 serving = 100g" fiction saveRecipe() uses
// for recipes: kcal/protein_g/fat_g/carbs_g on the item are already the
// absolute amounts for its planned quantity, so they map directly onto a
// per-100g food logged at exactly 100g — addEntry()'s multiplication by
// quantity/100 becomes a no-op (100/100 = 1), and quantity_label shows
// the plan's own wording (e.g. "180 g", "1 Fatia (38 g)") instead of a
// raw gram amount.
function itemAsFood(item) {
  return {
    source: "mealplan",
    source_id: item.id,
    name: item.name,
    kcal_100g: item.kcal,
    protein_100g: item.protein_g,
    fat_100g: item.fat_g,
    carbs_100g: item.carbs_g,
    fiber_100g: 0,
    micros: {},
  };
}

export async function logMealPlanItem(item, mealType, loggedAt) {
  await addEntry(itemAsFood(item), 100, loggedAt, mealType, item.quantity_label);
}

// Undoes logMealPlanItem for today — looks up the specific food_log row
// (there should only ever be one per item per day under normal use) via
// the foods row's (source, source_id) mapping, scoped to the given date,
// and deletes it.
export async function unlogMealPlanItem(item, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data: food, error: foodErr } = await supabase
    .from("foods")
    .select("id")
    .eq("source", "mealplan")
    .eq("source_id", item.id)
    .limit(1)
    .maybeSingle();
  if (foodErr) throw foodErr;
  if (!food) return;

  const { data: rows, error: rowsErr } = await supabase
    .from("food_logs")
    .select("id")
    .eq("food_id", food.id)
    .gte("logged_at", start.toISOString())
    .lt("logged_at", end.toISOString());
  if (rowsErr) throw rowsErr;

  for (const row of rows || []) await deleteEntry(row.id);
}
