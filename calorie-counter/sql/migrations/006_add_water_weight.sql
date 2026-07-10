-- Run this once in the Supabase SQL Editor if your database already
-- exists from before water/weight logging was added. New setups get
-- these directly from schema.sql and don't need this file.

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  ml integer not null check (ml > 0)
);

create index if not exists water_logs_user_date_idx
  on public.water_logs (user_id, logged_at);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  kg numeric not null check (kg > 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.water_logs enable row level security;
alter table public.weight_logs enable row level security;

drop policy if exists water_logs_select_own on public.water_logs;
create policy water_logs_select_own
  on public.water_logs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists water_logs_insert_own on public.water_logs;
create policy water_logs_insert_own
  on public.water_logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists water_logs_delete_own on public.water_logs;
create policy water_logs_delete_own
  on public.water_logs for delete
  to authenticated
  using (user_id = auth.uid());

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
