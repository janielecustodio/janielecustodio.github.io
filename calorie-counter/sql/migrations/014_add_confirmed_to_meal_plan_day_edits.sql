-- Run this once in the Supabase SQL Editor if meal_plan_day_edits
-- already exists from migration 013 without the `confirmed` column.
-- New setups get this directly from schema.sql and don't need this file.
--
-- confirmed: whether "Registrar tudo" has been tapped for this option
-- today — the ONLY thing that drives the header button's green/
-- disabled state and the slot's auto-collapse, replacing an earlier
-- design that re-derived this by checking whether every item's own
-- food_logs row existed. That per-item aggregation was a real source
-- of bugs where the two could silently disagree (every item showing
-- as logged individually, yet the button never turning green).

alter table public.meal_plan_day_edits
  add column if not exists confirmed boolean not null default false;
