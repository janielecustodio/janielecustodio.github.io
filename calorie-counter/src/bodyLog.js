import { supabase } from "./supabaseClient.js";

function dayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Local Y-M-D, not toISOString().slice(0,10) — that goes through UTC and
// shifts the calendar date for any positive UTC-offset timezone (a local
// midnight becomes the previous day once converted to UTC).
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Water is quick-add, additive through the day — multiple rows per day,
// summed for the daily total, unlike weight's single-value-per-day model.
export async function addWater(ml, loggedAt) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("water_logs")
    .insert({ user_id: user.id, logged_at: loggedAt.toISOString(), ml });
  if (error) throw error;
}

export async function deleteWater(id) {
  const { error } = await supabase.from("water_logs").delete().eq("id", id);
  if (error) throw error;
}

export async function getWaterForDate(date) {
  const { start, end } = dayRange(date);
  const { data, error } = await supabase
    .from("water_logs")
    .select("*")
    .gte("logged_at", start.toISOString())
    .lt("logged_at", end.toISOString())
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// `date` is stored as a plain date (no time-of-day) — one weigh-in per
// day, so saving again the same day updates the existing row.
export async function saveWeight(date, kg) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const dateStr = toDateStr(date);
  const { error } = await supabase
    .from("weight_logs")
    .upsert({ user_id: user.id, date: dateStr, kg }, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function getWeightForDate(date) {
  const dateStr = toDateStr(date);
  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .eq("date", dateStr)
    .limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}
