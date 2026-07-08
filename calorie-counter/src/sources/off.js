const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";

function normalize(product) {
  const n = product.nutriments || {};
  return {
    source: "off",
    source_id: product.code,
    name: product.product_name || product.generic_name || "(unnamed product)",
    brand: product.brands || null,
    barcode: product.code,
    kcal_100g: n["energy-kcal_100g"] ?? 0,
    protein_100g: n["proteins_100g"] ?? 0,
    fat_100g: n["fat_100g"] ?? 0,
    carbs_100g: n["carbohydrates_100g"] ?? 0,
    fiber_100g: n["fiber_100g"] ?? 0,
    micros: {},
  };
}

export async function searchOFF(query) {
  const url = `${SEARCH_URL}?search_terms=${encodeURIComponent(
    query
  )}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,generic_name,brands,nutriments`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Food Facts search failed: ${res.status}`);
  const data = await res.json();
  return (data.products || [])
    .filter((p) => p.nutriments && p.nutriments["energy-kcal_100g"] != null)
    .map(normalize);
}

export async function lookupBarcode(barcode) {
  const res = await fetch(`${PRODUCT_URL}/${encodeURIComponent(barcode)}.json`);
  if (!res.ok) throw new Error(`Open Food Facts lookup failed: ${res.status}`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return normalize(data.product);
}
