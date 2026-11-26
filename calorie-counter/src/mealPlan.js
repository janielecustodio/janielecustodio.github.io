import { supabase } from "./supabaseClient.js";
import { addEntry, deleteEntry, updateEntry } from "./log.js";

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

// Idempotent by design, not just by convention — "Registrar tudo" is
// meant to reconcile what's logged with what's currently shown, never to
// blindly append, so logging an item already logged for this day is a
// no-op here regardless of what the caller already believed about its
// state (the UI's own loggedItemIds check is the fast path; this is the
// backstop against ever actually double-logging the same item/day).
export async function logMealPlanItem(item, mealType, loggedAt) {
  const existing = await findTodayLogRows(item, loggedAt);
  if (existing.length > 0) return;
  await addEntry(itemAsFood(item), 100, loggedAt, mealType, item.quantity_label);
}

// Looks up today's food_log row(s) for this plan item (there should only
// ever be one under normal use) via the foods row's (source, source_id)
// mapping, scoped to the given date — shared by unlog/relog below.
async function findTodayLogRows(item, date) {
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
  if (!food) return [];

  const { data: rows, error: rowsErr } = await supabase
    .from("food_logs")
    .select("id, logged_at, meal_type")
    .eq("food_id", food.id)
    .gte("logged_at", start.toISOString())
    .lt("logged_at", end.toISOString());
  if (rowsErr) throw rowsErr;
  return rows || [];
}

// Undoes logMealPlanItem for today.
export async function unlogMealPlanItem(item, date) {
  for (const row of await findTodayLogRows(item, date)) await deleteEntry(row.id);
}

// Re-applies the item's current macros to whatever's already logged
// today (e.g. after editing its quantity multiplier), preserving the
// original logged_at/meal_type — or logs it fresh if it wasn't logged
// yet, same as logMealPlanItem.
export async function relogMealPlanItem(item, mealType, date) {
  const rows = await findTodayLogRows(item, date);
  if (rows.length === 0) {
    await logMealPlanItem(item, mealType, new Date());
    return;
  }
  for (const row of rows) {
    await updateEntry(row.id, itemAsFood(item), 100, new Date(row.logged_at), row.meal_type || mealType, item.quantity_label);
  }
}

// Local Y-M-D, not toISOString().slice(0,10) — that goes through UTC and
// shifts the calendar date for any positive UTC-offset timezone (a local
// midnight becomes the previous day once converted to UTC).
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// One free-text note per slot per day — a place to jot "troquei o salmão
// por frango" etc. Returns a Map(slot_id -> note text) for the given day.
export async function getNotesForDate(date) {
  const dateStr = toDateStr(date);
  const { data, error } = await supabase.from("meal_plan_notes").select("slot_id, note").eq("date", dateStr);
  if (error) throw error;
  const bySlot = new Map();
  for (const row of data || []) bySlot.set(row.slot_id, row.note);
  return bySlot;
}

// Upserted, not appended — logging a note again the same day for the
// same slot updates the existing row (same pattern as saveWeight).
export async function saveNote(slotId, date, note) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const dateStr = toDateStr(date);
  const { error } = await supabase
    .from("meal_plan_notes")
    .upsert({ user_id: user.id, slot_id: slotId, date: dateStr, note }, { onConflict: "user_id,slot_id,date" });
  if (error) throw error;
}
