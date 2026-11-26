-- Run this once in the Supabase SQL Editor if your database already
-- exists from before per-day plan customization was added. New setups
-- get this directly from schema.sql and don't need this file.
--
-- Per-day customization of an option's menu — private per-user data,
-- same unique-row-per-day pattern as weight_logs/meal_plan_notes.
-- excluded_item_ids: template items the user didn't actually have today
-- (swiped away) — also unlogs them immediately if already logged.
-- quantity_multipliers: { item_id: multiplier } for a template item
-- eaten in a different amount than planned (e.g. 2 eggs instead of 1).
-- Extra foods added via the "+" button are NOT stored here — they're
-- just ordinary food_logs rows for the slot's meal_type.

create table if not exists public.meal_plan_day_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  option_id uuid not null references public.meal_plan_options (id) on delete cascade,
  date date not null,
  excluded_item_ids jsonb not null default '[]'::jsonb,
  quantity_multipliers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, option_id, date)
);

alter table public.meal_plan_day_edits enable row level security;

drop policy if exists meal_plan_day_edits_select_own on public.meal_plan_day_edits;
create policy meal_plan_day_edits_select_own
  on public.meal_plan_day_edits for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists meal_plan_day_edits_insert_own on public.meal_plan_day_edits;
create policy meal_plan_day_edits_insert_own
  on public.meal_plan_day_edits for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists meal_plan_day_edits_update_own on public.meal_plan_day_edits;
create policy meal_plan_day_edits_update_own
  on public.meal_plan_day_edits for update
  to authenticated
  using (user_id = auth.uid());
