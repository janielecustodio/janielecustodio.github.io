-- Run this once in the Supabase SQL Editor if your database already
-- exists from before the "ciclo das sementes" tracker was added. New
-- setups get this directly from schema.sql and don't need this file.
--
-- Tracks the start date of the user's current menstrual cycle, to
-- auto-select the right seed pairing for today (day 1-14 from this
-- date: semente de abóbora + linhaça; day 15-28: girassol + gergelim —
-- see the "Ciclo das sementes" slot in seed_meal_plan_xv.sql). One
-- settings row per user, same pattern as user_targets.

create table if not exists public.cycle_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cycle_start_date date,
  updated_at timestamptz not null default now()
);

alter table public.cycle_settings enable row level security;

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
