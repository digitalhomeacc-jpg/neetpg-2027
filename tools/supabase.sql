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

-- Apple Health without Safari (added later: safe to run again). An iPhone Shortcut sends sleep
-- times here in the background with a private key that only lets it write your own health row;
-- the app reads them the next time it's open.
create table if not exists public.pg27_health (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  key        text unique not null,
  data       jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pg27_health enable row level security;
drop policy if exists "own health: read"   on public.pg27_health;
drop policy if exists "own health: insert" on public.pg27_health;
drop policy if exists "own health: update" on public.pg27_health;
create policy "own health: read"   on public.pg27_health for select using (auth.uid() = user_id);
create policy "own health: insert" on public.pg27_health for insert with check (auth.uid() = user_id);
create policy "own health: update" on public.pg27_health for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on table public.pg27_health to authenticated;

create or replace function public.pg27_health_push(k text, ss text default null, se text default null, hrv text default null, rhr text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if k is null or length(k) < 20 then return 'missing key'; end if;
  if length(coalesce(ss, '')) + length(coalesce(se, '')) > 60000 then return 'too much data'; end if;
  update public.pg27_health
     set data = jsonb_build_object('ss', ss, 'se', se, 'hrv', hrv, 'rhr', rhr, 'at', now()), updated_at = now()
   where key = k;
  if not found then return 'unknown key: copy it again from the app'; end if;
  return 'ok';
end $$;
revoke all on function public.pg27_health_push(text, text, text, text, text) from public;
grant execute on function public.pg27_health_push(text, text, text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
