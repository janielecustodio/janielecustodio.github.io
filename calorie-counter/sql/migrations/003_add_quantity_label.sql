-- Run this once in the Supabase SQL Editor if your `food_logs` table
-- already exists from before unit-based quantities were added. New setups
-- get this column directly from schema.sql and don't need this file.

alter table public.food_logs add column if not exists quantity_label text;
