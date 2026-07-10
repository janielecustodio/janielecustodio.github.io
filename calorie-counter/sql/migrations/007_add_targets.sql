-- Run this once in the Supabase SQL Editor if your database already
-- exists from before targets/goals were added. New setups get this
-- directly from schema.sql and don't need this file.

create table if not exists public.user_targets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kcal numeric,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  updated_at timestamptz not null default now()
);

alter table public.user_targets enable row level security;

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
