import { USDA_API_KEY } from "../config.js";

const BASE = "https://api.nal.usda.gov/fdc/v1";

// SR Legacy items often carry two "Energy" entries — one in kcal, one in kJ.
// Matching on name alone risks grabbing the kJ value (~4.2x too high).
//
// The /foods/search endpoint returns flat nutrient objects
// ({nutrientName, unitName: "G"/"KCAL", value}), but the /food/{fdcId}
// detail endpoint nests the same info under `.nutrient` AND lowercases the
// unit ({nutrient: {name, unitName: "g"/"kcal"}, amount}) — confirmed
// against USDA's own published example response, not assumed. Both the
// nesting *and* the casing differences have to be handled, or this
// silently zeroes out protein/fat/carbs (defaulted via `?? 0` in
// normalize()) for anything fetched through fetchUsdaDetail, while kcal
// happens to have its own null-fallback in the merge that masks the same
// failure — which is exactly the bug that shipped from only fixing the
// nesting and missing the casing.
function nutrient(food, names, unit) {
  const hit = food.foodNutrients?.find((n) => {
    const name = n.nutrientName ?? n.nutrient?.name;
    const unitName = n.unitName ?? n.nutrient?.unitName;
    return names.includes(name) && (!unit || unitName?.toUpperCase() === unit.toUpperCase());
  });
  if (!hit) return null;
  return hit.value ?? hit.amount ?? null;
}

// foodPortions only appears on the full /food/{fdcId} detail response, not
// search results, and its fields are inconsistent across records (some put
// the unit name in `modifier`, some in `measureUnit.name` — which is often
// the literal placeholder "undetermined"). Build a defensive label from
// whatever's actually present rather than assuming one field is reliable.
function parsePortions(food) {
  if (!Array.isArray(food.foodPortions)) return [];
  const seen = new Set();
  const portions = [];
  for (const p of food.foodPortions) {
    const grams = Number(p.gramWeight);
    if (!grams || grams <= 0) continue;
    const parts = [];
    if (p.amount && p.amount !== 1) parts.push(String(p.amount));
    const unitName =
      p.measureUnit?.name && p.measureUnit.name.toLowerCase() !== "undetermined"
        ? p.measureUnit.name
        : null;
    if (unitName) parts.push(unitName);
    if (p.modifier) parts.push(p.modifier);
    if (p.portionDescription) parts.push(p.portionDescription);
    let label = parts.filter(Boolean).join(" ").trim();
    if (!label) label = `${Math.round(grams)}g portion`;
    const key = `${label}|${grams}`;
    if (seen.has(key)) continue;
    seen.add(key);
    portions.push({ label, grams });
  }
  return portions.slice(0, 6);
}

// Approximate, nice-to-have micronutrients — not present on every record,
// so each is left out of the `micros` object entirely (not defaulted to 0)
// when USDA doesn't report it.
function parseMicros(food) {
  const micros = {};
  const add = (key, names, unit) => {
    const v = nutrient(food, names, unit);
    if (v !== null) micros[key] = v;
  };
  add("sodium_mg", ["Sodium, Na"], "MG");
  add("sugars_g", ["Sugars, total including NLEA", "Sugars, total"], "G");
  // Only appears on Branded Foods (FDA label data) — Foundation/SR Legacy
  // whole-food records don't carry it, correctly, since they have none.
  add("added_sugars_g", ["Sugars, added"], "G");
  add("saturated_fat_g", ["Fatty acids, total saturated"], "G");
  add("potassium_mg", ["Potassium, K"], "MG");
  add("calcium_mg", ["Calcium, Ca"], "MG");
  add("iron_mg", ["Iron, Fe"], "MG");
  add("vitamin_c_mg", ["Vitamin C, total ascorbic acid"], "MG");
  return micros;
}

function normalize(food) {
  return {
    source: "usda",
    source_id: String(food.fdcId),
    name: food.description,
    brand: food.brandOwner || food.brandName || null,
    barcode: food.gtinUpc || null,
    kcal_100g: nutrient(food, ["Energy"], "KCAL"),
    protein_100g: nutrient(food, ["Protein"], "G") ?? 0,
    fat_100g: nutrient(food, ["Total lipid (fat)"], "G") ?? 0,
    carbs_100g: nutrient(food, ["Carbohydrate, by difference"], "G") ?? 0,
    fiber_100g: nutrient(food, ["Fiber, total dietary"], "G") ?? 0,
    micros: parseMicros(food),
    portions: parsePortions(food),
  };
}

// The search endpoint's nutrient list is sometimes incomplete (missing
// Energy, or missing it in KCAL specifically) even for perfectly valid
// foods — fetch the full record to backfill it. Exported so the caller can
// bound *how many* of these extra requests fire (see foodSearch.js) — doing
// this for every result in a 25-50 item page was the search slowdown: one
// query could fan out into dozens of parallel USDA requests.
export async function backfillMissingEnergy(food) {
  if (food.kcal_100g !== null) return food;
  try {
    const detail = await fetchUsdaDetail(food.source_id);
    return { ...food, ...detail, kcal_100g: detail.kcal_100g ?? food.kcal_100g };
  } catch {
    return food;
  }
}

// foodPortions (household units like "1 large", "1 slice") only comes back
// on the full detail record, never the search endpoint — fetched lazily
// when the user actually selects a result to add, not for every search hit.
export async function fetchUsdaDetail(fdcId) {
  const res = await fetch(`${BASE}/food/${fdcId}?api_key=${USDA_API_KEY}`);
  if (!res.ok) throw new Error(`USDA detail fetch failed: ${res.status}`);
  const full = await res.json();
  return normalize(full);
}

export async function searchUSDA(query) {
  // POST with a JSON body is the reliable way to pass array filters like
  // dataType — the GET query-string form (dataType=Foundation,SR Legacy)
  // silently failed to filter anything, letting Branded/processed items
  // through and diluting results for whole-food searches.
  const res = await fetch(`${BASE}/foods/search?api_key=${USDA_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      pageSize: 25,
      dataType: ["Foundation", "SR Legacy"],
    }),
  });
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`);
  const data = await res.json();
  // No backfill here — kcal_100g may be null. foodSearch.js ranks first,
  // then backfills only the handful of results actually shown.
  return (data.foods || []).map(normalize);
}
