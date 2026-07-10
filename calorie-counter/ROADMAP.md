# Roadmap

Features considered but not built yet, kept here so they aren't lost.
Streaks and social/sharing features were explicitly ruled out — this is
a private single-user app and stays that way.

Everything below needs a Supabase migration (unlike edit/log-again/
frequent-foods/copy-day, which shipped without touching the schema at
all). Pick any of these up whenever — say the word.

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
