import { USDA_API_KEY } from "../config.js";

const BASE = "https://api.nal.usda.gov/fdc/v1";

// SR Legacy items often carry two "Energy" entries — one in kcal, one in kJ.
// Matching on name alone risks grabbing the kJ value (~4.2x too high).
function nutrient(food, names, unit) {
  const hit = food.foodNutrients?.find(
    (n) => names.includes(n.nutrientName) && (!unit || n.unitName === unit)
  );
  return hit?.value ?? null;
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
    micros: {},
  };
}

// The search endpoint's nutrient list is sometimes incomplete (missing
// Energy, or missing it in KCAL specifically) even for perfectly valid
// foods — fetch the full record for anything that came back empty.
async function backfillMissingEnergy(food) {
  if (food.kcal_100g !== null) return food;
  try {
    const res = await fetch(`${BASE}/food/${food.source_id}?api_key=${USDA_API_KEY}`);
    if (!res.ok) return food;
    const full = await res.json();
    const detail = normalize(full);
    return { ...food, ...detail, kcal_100g: detail.kcal_100g ?? food.kcal_100g };
  } catch {
    return food;
  }
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
      pageSize: 50,
      dataType: ["Foundation", "SR Legacy"],
    }),
  });
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`);
  const data = await res.json();
  const results = await Promise.all((data.foods || []).map(normalize).map(backfillMissingEnergy));
  // Drop entries USDA genuinely has no usable energy data for, rather than
  // showing a false "0 kcal" that looks like a real (wrong) answer.
  return results
    .filter((f) => f.kcal_100g !== null)
    .map((f) => ({ ...f, kcal_100g: f.kcal_100g }));
}
