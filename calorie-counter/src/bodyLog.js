import { supabase } from "./supabaseClient.js";

// Local Y-M-D, not toISOString().slice(0,10) — that goes through UTC and
// shifts the calendar date for any positive UTC-offset timezone (a local
// midnight becomes the previous day once converted to UTC).
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

// Powers the Trends view's Weight chart — weigh-ins are sparse (not every
// day has one), so callers should not assume one row per day in the range.
export async function getWeightForRange(startDate, endDateExclusive) {
  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .gte("date", toDateStr(startDate))
    .lt("date", toDateStr(endDateExclusive))
    .order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}
