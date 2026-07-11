import { searchUSDA, backfillMissingEnergy } from "./sources/usda.js";
import { searchOFF } from "./sources/off.js";
import { searchTaco } from "./sources/taco.js";
import { searchRecipes } from "./sources/recipes.js";

// How many top-ranked results get a USDA detail-fetch to backfill missing
// calorie data. Bounded on purpose — backfilling every result in a page of
// 25 was firing dozens of parallel requests and making search feel stuck.
const BACKFILL_LIMIT = 10;

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
  const [usda, off, taco, recipes] = await Promise.allSettled([
    searchUSDA(query),
    searchOFF(query),
    searchTaco(query),
    searchRecipes(query),
  ]);

  const results = [];
  for (const [label, outcome] of [
    ["usda", usda],
    ["off", off],
    ["taco", taco],
    ["recipes", recipes],
  ]) {
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      console.warn(`${label} search failed:`, outcome.reason);
    }
  }

  const queryWords = wordsOf(query);
  // Every query word has to appear somewhere in the name (any order) — a
  // source returning a loosely-related result (e.g. USDA's own search
  // matching on just one of several query words) doesn't get a foot in
  // the door just because it scores non-zero; it's excluded outright.
  const matching = results.filter((r) => {
    const nameWordSet = new Set(wordsOf(r.name));
    return queryWords.every((w) => nameWordSet.has(w));
  });
  matching.sort(
    (a, b) => relevanceScore(b.name, queryWords) - relevanceScore(a.name, queryWords)
  );

  // Rank first, *then* backfill — only the results actually worth showing
  // pay for the extra USDA round-trip. Items further down that still turn
  // out to have no usable calorie data are silently dropped (equivalent to
  // never having matched — nobody was going to scroll to them anyway).
  const visible = await Promise.all(
    matching
      .slice(0, BACKFILL_LIMIT)
      .map((f) => (f.source === "usda" ? backfillMissingEnergy(f) : f))
  );
  const rest = matching.slice(BACKFILL_LIMIT);
  return [...visible, ...rest].filter((f) => f.kcal_100g !== null);
}
