import { searchUSDA } from "./sources/usda.js";
import { searchOFF } from "./sources/off.js";
import { searchTaco } from "./sources/taco.js";

function wordsOf(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// The underlying APIs' own relevance ranking is weak for multi-word queries
// (e.g. "chicken breast" can bury the plain match under "chicken feet" or
// "chicken breast roll, oven-roasted"). Re-rank by how many query words the
// name actually contains, penalizing names with lots of extra qualifiers —
// so a plain "Chicken, breast, raw" outranks a heavily-qualified variant.
function relevanceScore(name, queryWords) {
  const nameWords = wordsOf(name);
  const nameWordSet = new Set(nameWords);
  const matched = queryWords.filter((w) => nameWordSet.has(w)).length;
  const extraWords = nameWords.length - matched;
  return matched * 10 - extraWords * 0.5;
}

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

  const queryWords = wordsOf(query);
  results.sort(
    (a, b) => relevanceScore(b.name, queryWords) - relevanceScore(a.name, queryWords)
  );
  return results;
}
