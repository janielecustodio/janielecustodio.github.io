import { USDA_API_KEY } from "../config.js";

const BASE = "https://api.nal.usda.gov/fdc/v1";

function nutrient(food, names) {
  const hit = food.foodNutrients?.find((n) =>
    names.includes(n.nutrientName)
  );
  return hit?.value ?? 0;
}

function normalize(food) {
  return {
    source: "usda",
    source_id: String(food.fdcId),
    name: food.description,
    brand: food.brandOwner || food.brandName || null,
    barcode: food.gtinUpc || null,
    kcal_100g: nutrient(food, ["Energy"]),
    protein_100g: nutrient(food, ["Protein"]),
    fat_100g: nutrient(food, ["Total lipid (fat)"]),
    carbs_100g: nutrient(food, ["Carbohydrate, by difference"]),
    fiber_100g: nutrient(food, ["Fiber, total dietary"]),
    micros: {},
  };
}

export async function searchUSDA(query) {
  const url = `${BASE}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(
    query
  )}&pageSize=15&dataType=Foundation,SR%20Legacy`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`);
  const data = await res.json();
  return (data.foods || []).map(normalize);
}
