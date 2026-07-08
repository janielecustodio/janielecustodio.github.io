import { searchUSDA } from "./sources/usda.js";
import { searchOFF } from "./sources/off.js";
import { searchTaco } from "./sources/taco.js";

// Queries all three sources in parallel. A slow or failing source (e.g. a
// CORS hiccup, USDA rate limit) never blocks the others — it's just
// dropped, with a console warning for debugging.
export async function searchAll(query) {
  const [usda, off, taco] = await Promise.allSettled([
    searchUSDA(query),
    searchOFF(query),
    searchTaco(query),
  ]);

  const results = [];
  for (const [label, outcome] of [
    ["usda", usda],
    ["off", off],
    ["taco", taco],
  ]) {
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      console.warn(`${label} search failed:`, outcome.reason);
    }
  }
  return results;
}
