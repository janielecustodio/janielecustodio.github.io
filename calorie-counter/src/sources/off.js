const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";

// OFF gives one serving size, not a list — e.g. `serving_size: "1 slice (28 g)"`
// with `serving_quantity` as the already-parsed gram number when available.
// Strip the trailing "(NN g)" off the label so it doesn't repeat "28 g" twice.
function parsePortion(product) {
  const raw = product.serving_size;
  const qty = Number(product.serving_quantity);
  const stripGrams = (s) => s.replace(/\(?\s*[\d.]+\s*g\)?\s*$/i, "").trim();

  if (qty > 0) {
    const label = raw ? stripGrams(raw) : "";
    return { label: label || `${qty} g serving`, grams: qty };
  }
  if (raw) {
    const m = raw.match(/([\d.]+)\s*g\b/i);
    if (m && Number(m[1]) > 0) {
      const label = stripGrams(raw);
      return { label: label || raw, grams: Number(m[1]) };
    }
  }
  return null;
}

function normalize(product) {
  const n = product.nutriments || {};
  const portion = parsePortion(product);
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
    portions: portion ? [portion] : [],
  };
}

export async function searchOFF(query) {
  const url = `${SEARCH_URL}?search_terms=${encodeURIComponent(
    query
  )}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,generic_name,brands,nutriments,serving_size,serving_quantity`;
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
