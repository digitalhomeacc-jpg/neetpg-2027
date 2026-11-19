-- PG 2027 sync: run this once in your Supabase project (SQL Editor → New query → Run).
-- One row per account holds that person's whole study state. Row-level security means
-- each signed-in person can read and write only their own row.

create table if not exists public.pg27_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pg27_state enable row level security;

drop policy if exists "own row: read"   on public.pg27_state;
drop policy if exists "own row: insert" on public.pg27_state;
drop policy if exists "own row: update" on public.pg27_state;

create policy "own row: read"   on public.pg27_state for select using (auth.uid() = user_id);
create policy "own row: insert" on public.pg27_state for insert with check (auth.uid() = user_id);
create policy "own row: update" on public.pg27_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
