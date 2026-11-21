-- PG 2027: alarms. The app keeps a list of upcoming alarms (duty shifts and study blocks with an
-- alarm) in your synced data. Your Shortcut calls pg27_alarms with your private key; it returns
-- the alarms due in the next 36 hours that it hasn't handed out before, and remembers them, so
-- running the Shortcut many times never creates the same alarm twice. Safe to run again.
alter table public.pg27_health add column if not exists alarms_sent jsonb not null default '[]'::jsonb;

create or replace function public.pg27_alarms(k text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid; sent jsonb; fresh jsonb;
begin
  if k is null or length(k) < 20 then return '[]'::jsonb; end if;
  select user_id, alarms_sent into uid, sent from public.pg27_health where key = k;
  if uid is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(a order by a->>'at'), '[]'::jsonb) into fresh
    from public.pg27_state s, jsonb_array_elements(coalesce(s.data->'alarmsOut', '[]'::jsonb)) a
   where s.user_id = uid
     and (a->>'at')::timestamptz > now()
     and (a->>'at')::timestamptz < now() + interval '36 hours'
     and not (sent ? (a->>'id'));
  -- Remember what was handed out (only the last few days, so the list stays small).
  update public.pg27_health
     set alarms_sent = (
       select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from (
         select jsonb_array_elements_text(sent) as x
         union select f->>'id' from jsonb_array_elements(fresh) f
       ) q where q.x >= to_char(now() - interval '3 days', 'YYYY-MM-DD'))
   where user_id = uid;
  return fresh;
end $$;
revoke all on function public.pg27_alarms(text) from public;
grant execute on function public.pg27_alarms(text) to anon, authenticated;
notify pgrst, 'reload schema';

select exists (select 1 from pg_proc where proname = 'pg27_alarms') as alarms_ok;
