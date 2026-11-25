-- Run this once in the Supabase SQL Editor if your database already
-- exists from before the meal plan feature was added. New setups get
-- this directly from schema.sql and don't need this file.
--
-- The nutritionist's plan is fixed (with alternative options per slot),
-- not re-issued daily/weekly, so it's modeled as shared reference data —
-- same RLS pattern as `foods` — rather than per-user rows. "Logging" an
-- item reuses the existing food_logs pipeline unchanged: each meal plan
-- item gets its own `foods` row (source='mealplan'), so addEntry()/
-- deleteEntry() and the whole Today's Log / Trends machinery just work.
-- Whether an item is "done" today is derived by checking whether a
-- food_log entry exists for its mapped food today — no separate status
-- column or table needed.

create table if not exists public.meal_plan_slots (
  id uuid primary key default gen_random_uuid(),
  order_index integer not null,
  time_label text,
  title text not null,
  meal_type text not null check (meal_type in (
    'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'
  )),
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plan_options (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.meal_plan_slots (id) on delete cascade,
  -- null when the slot has just one fixed option (no alternative tabs).
  option_number integer,
  option_label text,
  observations text,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.meal_plan_options (id) on delete cascade,
  order_index integer not null,
  name text not null,
  quantity_label text,
  -- Snapshot macros for this item at its planned quantity (not per-100g) —
  -- mapped to a foods row using the same "1 serving" fiction saveRecipe()
  -- uses, since the quantity here is fixed by the plan, not user-entered.
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  carbs_g numeric not null default 0,
  is_supplement boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists meal_plan_options_slot_idx on public.meal_plan_options (slot_id);
create index if not exists meal_plan_items_option_idx on public.meal_plan_items (option_id);

alter table public.meal_plan_slots enable row level security;
alter table public.meal_plan_options enable row level security;
alter table public.meal_plan_items enable row level security;

-- Same reasoning as `foods`: shared reference data for this single-user
-- app, not scoped by user_id.
drop policy if exists meal_plan_slots_select on public.meal_plan_slots;
create policy meal_plan_slots_select
  on public.meal_plan_slots for select
  to authenticated
  using (true);

drop policy if exists meal_plan_slots_write on public.meal_plan_slots;
create policy meal_plan_slots_write
  on public.meal_plan_slots for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists meal_plan_options_select on public.meal_plan_options;
create policy meal_plan_options_select
  on public.meal_plan_options for select
  to authenticated
  using (true);

drop policy if exists meal_plan_options_write on public.meal_plan_options;
create policy meal_plan_options_write
  on public.meal_plan_options for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists meal_plan_items_select on public.meal_plan_items;
create policy meal_plan_items_select
  on public.meal_plan_items for select
  to authenticated
  using (true);

drop policy if exists meal_plan_items_write on public.meal_plan_items;
create policy meal_plan_items_write
  on public.meal_plan_items for all
  to authenticated
  using (true)
  with check (true);
