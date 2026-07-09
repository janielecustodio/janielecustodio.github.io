import { searchUSDA } from "./sources/usda.js";
import { searchOFF } from "./sources/off.js";
import { searchTaco } from "./sources/taco.js";

function wordsOf(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Cooking method / state words shouldn't count the same as the actual food
// noun — "boiled chicken breast" matching "chicken"+"boiled" (e.g. chicken
// FEET, boiled) is not what anyone means by that query; "chicken"+"breast"
// matters far more than "boiled" does. Down-weight these relative to core
// food-name words instead of treating every query word as equally important.
const MODIFIER_WORDS = new Set([
  "raw", "boiled", "cooked", "uncooked", "fried", "grilled", "roasted",
  "baked", "steamed", "smoked", "poached", "broiled", "sauteed", "stewed",
  "braised", "microwaved", "boneless", "skinless", "frozen", "canned",
  "dried", "fresh", "whole", "sliced", "chopped", "diced", "ground",
]);

function relevanceScore(name, queryWords) {
  const nameWords = wordsOf(name);
  const nameWordSet = new Set(nameWords);

  const coreWords = queryWords.filter((w) => !MODIFIER_WORDS.has(w));
  const modifierWords = queryWords.filter((w) => MODIFIER_WORDS.has(w));
  // A query that's *only* modifier words (rare) falls back to treating them
  // all as core, so it still scores meaningfully.
  const effectiveCore = coreWords.length > 0 ? coreWords : queryWords;

  const coreMatched = effectiveCore.filter((w) => nameWordSet.has(w)).length;
  const coreCoverage = coreMatched / effectiveCore.length;
  const fullCoreBonus = coreMatched === effectiveCore.length ? 1000 : 0;
  const modifierMatched = modifierWords.filter((w) => nameWordSet.has(w)).length;

  return fullCoreBonus + coreCoverage * 100 + modifierMatched * 20 - nameWords.length;
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
