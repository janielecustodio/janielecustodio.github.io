-- Run this once in the Supabase SQL Editor if your database already
-- exists from before supplement timing was added. New setups get this
-- directly from schema.sql and don't need this file.
--
-- Only meaningful when is_supplement is true. null means the supplement
-- is an ingredient of the recipe it's listed under (e.g. collagen
-- blended into a shake) and renders inline with the food items, in its
-- normal order_index position. 'antes'/'depois' means it's taken as a
-- separate dose before/after the meal, and renders in its own block
-- above/below the food items instead. Re-run seed_meal_plan_xv.sql
-- after this to populate the actual values.

alter table public.meal_plan_items
  add column if not exists supplement_timing text check (supplement_timing in ('antes', 'depois'));
