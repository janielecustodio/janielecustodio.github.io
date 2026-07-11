-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- See ../SETUP.md for the full setup walkthrough.

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('usda', 'taco', 'tbca', 'off', 'manual', 'recipe')),
  source_id text not null,
  name text not null,
  brand text,
  barcode text,
  kcal_100g numeric not null default 0,
  protein_100g numeric not null default 0,
  fat_100g numeric not null default 0,
  carbs_100g numeric not null default 0,
  fiber_100g numeric default 0,
  micros jsonb not null default '{}'::jsonb,
  -- Only set for source = 'recipe': the ingredient list this recipe's
  -- macros were computed from, kept for reference/future editing. Not
  -- read at log time — kcal_100g etc already hold the per-serving totals.
  recipe_ingredients jsonb,
  synced_at timestamptz not null default now(),
  unique (source, source_id)
);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id),
  logged_at timestamptz not null default now(),
  meal_type text check (meal_type in (
    'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'
  )),
  quantity_g numeric not null check (quantity_g > 0),
  -- Friendly form of the quantity when logged by unit rather than a raw
  -- gram amount, e.g. "2x large egg" — quantity_g is still always the
  -- source of truth for macros; this is display-only and nullable.
  quantity_label text,
  -- Snapshot of the food's macros at the logged quantity, so historical
  -- entries never change if the cached `foods` row is later re-synced.
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fiber_g numeric default 0,
  micros jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_date_idx
  on public.food_logs (user_id, logged_at);

-- One settings-style row per user — not day-scoped like the log tables.
-- Every column is nullable: an unset target just means "don't show it",
-- not zero.
create table if not exists public.user_targets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kcal numeric,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  updated_at timestamptz not null default now()
);

-- One measurement per day (weigh-in) — logging again the same day
-- updates rather than adds a second row.
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  kg numeric not null check (kg > 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.foods enable row level security;
alter table public.food_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.user_targets enable row level security;

-- `foods` is a shared lookup cache, not per-user data: any authenticated
-- user of this app can read it and add/refresh entries via search.
drop policy if exists foods_select_authenticated on public.foods;
create policy foods_select_authenticated
  on public.foods for select
  to authenticated
  using (true);

drop policy if exists foods_insert_authenticated on public.foods;
create policy foods_insert_authenticated
  on public.foods for insert
  to authenticated
  with check (true);

drop policy if exists foods_update_authenticated on public.foods;
create policy foods_update_authenticated
  on public.foods for update
  to authenticated
  using (true);

-- `food_logs` is private per-user health data.
drop policy if exists food_logs_select_own on public.food_logs;
create policy food_logs_select_own
  on public.food_logs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists food_logs_insert_own on public.food_logs;
create policy food_logs_insert_own
  on public.food_logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists food_logs_update_own on public.food_logs;
create policy food_logs_update_own
  on public.food_logs for update
  to authenticated
  using (user_id = auth.uid());

drop policy if exists food_logs_delete_own on public.food_logs;
create policy food_logs_delete_own
  on public.food_logs for delete
  to authenticated
  using (user_id = auth.uid());

-- `weight_logs` is private per-user data, same pattern as food_logs.
drop policy if exists weight_logs_select_own on public.weight_logs;
create policy weight_logs_select_own
  on public.weight_logs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists weight_logs_insert_own on public.weight_logs;
create policy weight_logs_insert_own
  on public.weight_logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists weight_logs_update_own on public.weight_logs;
create policy weight_logs_update_own
  on public.weight_logs for update
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_targets_select_own on public.user_targets;
create policy user_targets_select_own
  on public.user_targets for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_targets_insert_own on public.user_targets;
create policy user_targets_insert_own
  on public.user_targets for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_targets_update_own on public.user_targets;
create policy user_targets_update_own
  on public.user_targets for update
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_targets_delete_own on public.user_targets;
create policy user_targets_delete_own
  on public.user_targets for delete
  to authenticated
  using (user_id = auth.uid());
