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

-- Newer Supabase projects don't give the API roles access to tables made in the SQL editor.
-- Without this, sync fails with "permission denied for table pg27_state".
-- (Row-level security above still limits everyone to their own row.)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.pg27_state to anon, authenticated;
-- The PYT pack syncs in its own column (added later: safe to run again).
alter table public.pg27_state add column if not exists pyt jsonb;
notify pgrst, 'reload schema';

-- Check: this should list "authenticated" with SELECT, INSERT, UPDATE and DELETE.
select grantee, privilege_type from information_schema.role_table_grants where table_name = 'pg27_state' order by 1, 2;
