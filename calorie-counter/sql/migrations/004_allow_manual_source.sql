-- Run this once in the Supabase SQL Editor if your `foods` table already
-- exists from before manual quick-add was added. New setups get this
-- directly from schema.sql and don't need this file.

alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check check (source in (
  'usda', 'taco', 'tbca', 'off', 'manual'
));
