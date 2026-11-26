import { supabase } from "./supabaseClient.js";

// Local Y-M-D, not toISOString().slice(0,10) — that goes through UTC and
// shifts the calendar date for any positive UTC-offset timezone.
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const EMPTY_EDITS = { excluded_item_ids: [], quantity_multipliers: {}, confirmed: false };

// Per-day customization of one option's menu — excluded items, quantity
// multipliers, and whether "Registrar tudo" has been confirmed for this
// option today (see migrations/013_add_meal_plan_day_edits.sql and
// 014_add_confirmed_to_meal_plan_day_edits.sql). `confirmed` is the ONLY
// thing that decides the header button's green/disabled state — it is
// never re-derived by checking each item's own logged status, which is
// what let the two disagree. Never returns null so callers don't have to
// special-case "no edits yet".
export async function getDayEdits(optionId, date) {
  const dateStr = toDateStr(date);
  const { data, error } = await supabase
    .from("meal_plan_day_edits")
    .select("excluded_item_ids, quantity_multipliers, confirmed")
    .eq("option_id", optionId)
    .eq("date", dateStr)
    .limit(1);
  if (error) throw error;
  const row = data && data[0];
  return row
    ? {
        excluded_item_ids: row.excluded_item_ids || [],
        quantity_multipliers: row.quantity_multipliers || {},
        confirmed: !!row.confirmed,
      }
    : { ...EMPTY_EDITS };
}

// Read-modify-write: fetches the current row, applies `mutate` to a copy,
// and upserts the result. Fine for this app's single-device-at-a-time
// usage — no concurrent-write protection needed.
async function updateDayEdits(optionId, date, mutate) {
  const current = await getDayEdits(optionId, date);
  const next = mutate({
    excluded_item_ids: [...current.excluded_item_ids],
    quantity_multipliers: { ...current.quantity_multipliers },
    confirmed: current.confirmed,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const dateStr = toDateStr(date);
  const { error } = await supabase.from("meal_plan_day_edits").upsert(
    {
      user_id: user.id,
      option_id: optionId,
      date: dateStr,
      excluded_item_ids: next.excluded_item_ids,
      quantity_multipliers: next.quantity_multipliers,
      confirmed: next.confirmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,option_id,date" }
  );
  if (error) throw error;
}

export async function setItemExcluded(optionId, date, itemId, excluded) {
  await updateDayEdits(optionId, date, (edits) => {
    edits.excluded_item_ids = edits.excluded_item_ids.filter((id) => id !== itemId);
    if (excluded) edits.excluded_item_ids.push(itemId);
    // The menu changed, so whatever was confirmed before no longer
    // reflects what's actually on it today.
    edits.confirmed = false;
    return edits;
  });
}

export async function setItemMultiplier(optionId, date, itemId, multiplier) {
  await updateDayEdits(optionId, date, (edits) => {
    if (multiplier === 1) delete edits.quantity_multipliers[itemId];
    else edits.quantity_multipliers[itemId] = multiplier;
    return edits;
  });
}

// Sets (or clears) whether "Registrar tudo" has been confirmed for this
// option today — the single source of truth for the header button's
// green/disabled state, never computed by checking individual items.
export async function setConfirmed(optionId, date, confirmed) {
  await updateDayEdits(optionId, date, (edits) => ({ ...edits, confirmed }));
}

// Discards every exclusion and quantity edit for this option/date — back
// to exactly what the nutritionist's plan says, no per-item undo needed.
// Also un-confirms: the menu just changed (exclusions removed may bring
// back items that were never logged), so a fresh confirm is needed.
export async function resetDayEdits(optionId, date) {
  await updateDayEdits(optionId, date, () => ({ excluded_item_ids: [], quantity_multipliers: {}, confirmed: false }));
}
