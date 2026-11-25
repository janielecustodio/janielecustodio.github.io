-- Run this once in the Supabase SQL Editor if your database already
-- exists from before meal-plan notes were added. New setups get this
-- directly from schema.sql and don't need this file.
--
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

alter table public.meal_plan_notes enable row level security;

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
