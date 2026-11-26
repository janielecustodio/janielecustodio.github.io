import { supabase } from "./supabaseClient.js";

// Local Y-M-D, not toISOString().slice(0,10) — that goes through UTC and
// shifts the calendar date for any positive UTC-offset timezone.
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const EMPTY_EDITS = { excluded_item_ids: [], quantity_multipliers: {} };

// Per-day customization of one option's menu (excluded items, quantity
// multipliers) — see migrations/013_add_meal_plan_day_edits.sql. Never
// returns null so callers don't have to special-case "no edits yet".
export async function getDayEdits(optionId, date) {
  const dateStr = toDateStr(date);
  const { data, error } = await supabase
    .from("meal_plan_day_edits")
    .select("excluded_item_ids, quantity_multipliers")
    .eq("option_id", optionId)
    .eq("date", dateStr)
    .limit(1);
  if (error) throw error;
  const row = data && data[0];
  return row
    ? { excluded_item_ids: row.excluded_item_ids || [], quantity_multipliers: row.quantity_multipliers || {} }
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
