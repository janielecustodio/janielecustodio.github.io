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

-- The nutritionist's meal plan: fixed, with alternative options per time
-- slot. Shared reference data (not per-user), same reasoning as `foods`.
-- "Logging" an item reuses food_logs unchanged — see
-- migrations/008_add_meal_plan.sql for the full explanation.
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
  -- Snapshot macros for this item at its planned quantity (not per-100g).
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  carbs_g numeric not null default 0,
  is_supplement boolean not null default false,
  -- Items sharing the same (option_id, substitution_group) are
  -- interchangeable ("ou peito de frango" etc.) — the one with the
  -- lowest order_index is the plan's default; which one is "active" for
  -- display/logging is a client-side choice (see planView.js), not
  -- stored here, same as which option tab is showing.
  substitution_group text,
  -- Only meaningful when is_supplement is true. null means the
  -- supplement is an ingredient of the recipe it's listed under (e.g.
  -- collagen blended into a shake) and renders inline with the food
  -- items, in its normal order_index position. 'antes'/'depois' means
  -- it's taken as a separate dose before/after the meal, and renders in
  -- its own block above/below the food items instead.
  supplement_timing text check (supplement_timing in ('antes', 'depois')),
  created_at timestamptz not null default now()
);

create index if not exists meal_plan_options_slot_idx on public.meal_plan_options (slot_id);
create index if not exists meal_plan_items_option_idx on public.meal_plan_items (option_id);

-- Free-text note per slot per day (e.g. "troquei o salmão por frango") —
-- private per-user data, same pattern as weight_logs: one row per
-- (user, slot, day), upserted rather than appended to.
create table if not exists public.meal_plan_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_id uuid not null references public.meal_plan_slots (id) on delete cascade,
  date date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, slot_id, date)
);

-- Per-day customization of an option's menu — private per-user data,
-- same unique-row-per-day pattern as weight_logs/meal_plan_notes.
-- excluded_item_ids: template items the user didn't actually have today
-- (swiped away) — also unlogs them immediately if already logged.
-- quantity_multipliers: { item_id: multiplier } for a template item
-- eaten in a different amount than planned (e.g. 2 eggs instead of 1) —
-- scales that item's kcal/protein_g/fat_g/carbs_g by this factor, both
-- for display and for what actually gets logged.
-- Extra foods added via the "+" button are NOT stored here — they're
-- just ordinary food_logs rows for the slot's meal_type, same as
-- anything added from the regular daily log.
-- confirmed: whether "Registrar tudo" has been tapped for this option
-- today — the ONLY thing that drives the header button's green/
-- disabled state and the slot's auto-collapse. Deliberately not
-- re-derived by checking whether every item's own food_logs row
-- exists: that per-item aggregation was a real source of bugs where
-- the two could silently disagree. Excluding an item, editing a
-- quantity, or resetting all clear this back to false, since each of
-- those changes what's actually on the menu since the last confirm.
create table if not exists public.meal_plan_day_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  option_id uuid not null references public.meal_plan_options (id) on delete cascade,
  date date not null,
  excluded_item_ids jsonb not null default '[]'::jsonb,
  quantity_multipliers jsonb not null default '{}'::jsonb,
  confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, option_id, date)
);

-- Tracks the start date of the user's current menstrual cycle, to
-- auto-select the right "ciclo das sementes" seed pairing for today
-- (day 1-14 from this date: semente de abóbora + linhaça; day 15-28:
-- girassol + gergelim — see the "Ciclo das sementes" slot below). One
-- settings row per user, same pattern as user_targets — update the date
-- whenever a new period starts; the 28-day split then just repeats from
-- there.
create table if not exists public.cycle_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cycle_start_date date,
  updated_at timestamptz not null default now()
);

alter table public.foods enable row level security;
alter table public.food_logs enable row level security;
alter table public.cycle_settings enable row level security;
alter table public.weight_logs enable row level security;
alter table public.user_targets enable row level security;
alter table public.meal_plan_slots enable row level security;
alter table public.meal_plan_options enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.meal_plan_notes enable row level security;
alter table public.meal_plan_day_edits enable row level security;

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

-- `cycle_settings` is private per-user data, same pattern as user_targets.
drop policy if exists cycle_settings_select_own on public.cycle_settings;
create policy cycle_settings_select_own
  on public.cycle_settings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists cycle_settings_insert_own on public.cycle_settings;
create policy cycle_settings_insert_own
  on public.cycle_settings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists cycle_settings_update_own on public.cycle_settings;
create policy cycle_settings_update_own
  on public.cycle_settings for update
  to authenticated
  using (user_id = auth.uid());

-- `meal_plan_notes` is private per-user data, same pattern as weight_logs.
drop policy if exists meal_plan_notes_select_own on public.meal_plan_notes;
create policy meal_plan_notes_select_own
  on public.meal_plan_notes for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists meal_plan_notes_insert_own on public.meal_plan_notes;
create policy meal_plan_notes_insert_own
  on public.meal_plan_notes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists meal_plan_notes_update_own on public.meal_plan_notes;
create policy meal_plan_notes_update_own
  on public.meal_plan_notes for update
  to authenticated
  using (user_id = auth.uid());

-- `meal_plan_day_edits` is private per-user data, same pattern as
-- meal_plan_notes.
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
