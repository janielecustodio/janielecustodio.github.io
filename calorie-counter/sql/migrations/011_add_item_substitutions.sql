-- Run this once in the Supabase SQL Editor if your database already
-- exists from before item-level substitutions were added. New setups
-- get this directly from schema.sql and don't need this file.
--
-- Items sharing the same (option_id, substitution_group) are
-- interchangeable ("ou peito de frango grelhado" etc.) — the one with
-- the lowest order_index is the plan's default; which one is "active"
-- for display/logging is a client-side choice, not stored here, same as
-- which option tab is showing. Re-run seed_meal_plan_xv.sql after this
-- to populate the actual substitution rows.

alter table public.meal_plan_items add column if not exists substitution_group text;
