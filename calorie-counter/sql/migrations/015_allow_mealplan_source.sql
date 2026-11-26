-- Run this once in the Supabase SQL Editor if your `foods` table already
-- exists from before this fix. New setups get this directly from
-- schema.sql and don't need this file.
--
-- 'mealplan' was always used as a source value when logging a plan item
-- (see src/mealPlan.js's itemAsFood()), but was never actually added to
-- this constraint — local mode has no real check constraint, so this
-- only ever surfaced once someone was logging against a real database.

alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check check (source in (
  'usda', 'taco', 'tbca', 'off', 'manual', 'recipe', 'mealplan'
));
