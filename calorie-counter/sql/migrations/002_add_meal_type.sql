-- Run this once in the Supabase SQL Editor if your `food_logs` table
-- already exists from before meal-type grouping was added. New setups
-- get this column directly from schema.sql and don't need this file.

alter table public.food_logs add column if not exists meal_type text;

alter table public.food_logs drop constraint if exists food_logs_meal_type_check;
alter table public.food_logs add constraint food_logs_meal_type_check check (meal_type in (
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'
));
