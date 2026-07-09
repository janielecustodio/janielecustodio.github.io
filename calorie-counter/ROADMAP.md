# Roadmap

Features considered but not built yet, kept here so they aren't lost.
Streaks and social/sharing features were explicitly ruled out — this is
a private single-user app and stays that way.

Everything below needs a Supabase migration (unlike edit/log-again/
frequent-foods/copy-day, which shipped without touching the schema at
all). Pick any of these up whenever — say the word.

## Manual quick-add
No good database match sometimes (homemade dish, restaurant meal) — a
bypass form to type kcal/protein/fat/carbs directly instead of searching.
- Schema: one `CHECK` constraint update on `foods.source` to allow
  `'manual'`. No new table.
- UI: a "Can't find it? Add manually" link under search results, opening
  a small form instead of the search flow.
- Effort: small-medium.

## Micronutrients, actually wired up
`micros jsonb` already exists on both `foods` and `food_logs` — it's
just never populated. This is finishing something half-built, not a new
feature.
- USDA and OFF both expose sodium, sugar, saturated fat, potassium,
  calcium, iron, vitamin C directly in the same responses already being
  fetched — needs a few more fields parsed in `src/sources/usda.js` and
  `src/sources/off.js`.
- UI: a modest expandable "Micronutrients" section under the daily
  summary — matches the original "approximate, nice-to-have" spec, not a
  full dashboard.
- Effort: medium, mostly in the two source parsers.

## Custom meals/recipes
Combine several ingredients into one named thing (e.g. "My protein
shake") that logs as a single tap instead of re-adding every ingredient
each time.
- Schema: one new nullable jsonb column on `foods`
  (`recipe_ingredients`) — no separate table. A recipe is a `foods` row
  with `source = 'recipe'` whose macros are pre-computed totals; it
  slots into `food_logs` exactly like any other food, zero change there.
- UI: a "Create recipe" flow (search/add multiple ingredients with
  quantities, then name and save); recipes appear in search alongside
  USDA/OFF/TACO, tagged distinctly. "1 serving" as a unit reuses the
  existing amount/unit picker.
- Effort: large — the biggest item here. New UI flow, and care needed on
  how servings map to grams.

## Trends over time
A week/month view — daily kcal as a line chart, macro trends over time.
- Schema: none — aggregates existing `food_logs` by date over a range,
  same math as the daily summary just repeated per day.
- UI: a new view (line chart, maybe a 7-day rolling average), separate
  from the single-day page that exists now. Should follow the same
  dataviz process used for the donut (form → color → validate → marks).
- Effort: medium-large. `main.js` is getting big enough that this is a
  good point to split it into a few files rather than keep bolting on.

## Water intake / body weight log
Both explicitly optional — only worth building if actually used, not
worth building speculatively.
- Schema: one small new table each (`water_logs`: date + ml;
  `weight_logs`: date + kg), fully independent of `food_logs`.
- UI: water — a simple quick-add row. Weight — a simple form, optionally
  a trend line if the Trends view above already exists.
- Effort: small-medium each, fully independent of everything else.

## Targets/goals
Explicitly deferred for v1 (logging + daily summary only, no targets) —
listed here because it's the natural "next" once/if that changes.
- Schema: one small settings-style table or row (target kcal + macros).
- UI: the donut's center label becomes "1,400 / 2,000 kcal" instead of
  just the total; legend rows could show target alongside actual.
- Effort: medium. Purely opt-in.
