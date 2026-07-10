# Roadmap

Features considered but not built yet, kept here so they aren't lost.
Streaks and social/sharing features were explicitly ruled out — this is
a private single-user app and stays that way.

Everything below needs a Supabase migration (unlike edit/log-again/
frequent-foods/copy-day, which shipped without touching the schema at
all). Pick any of these up whenever — say the word.

## Targets/goals
Explicitly deferred for v1 (logging + daily summary only, no targets) —
listed here because it's the natural "next" once/if that changes.
- Schema: one small settings-style table or row (target kcal + macros).
- UI: the donut's center label becomes "1,400 / 2,000 kcal" instead of
  just the total; legend rows could show target alongside actual.
- Effort: medium. Purely opt-in.
