create table if not exists public.calendar_entries (
 id uuid primary key, title text not null check(length(title) between 1 and 200),
 kind text not null check(kind in ('event','task')), day date not null,
 member text not null check(member in ('owner','wife','both')),
 start_time time, end_time time, completed boolean not null default false,
 reminder_at timestamptz, remind_to text check(remind_to in ('owner','wife','both')),
 version integer not null default 1, updated_at timestamptz not null default now(),
 check((kind='event' and start_time is not null and end_time>start_time and not completed) or
       (kind='task' and start_time is null and end_time is null)),
 check((reminder_at is null)=(remind_to is null))
);
create index if not exists calendar_days on public.calendar_entries(day);
create table if not exists public.calendar_reminders (
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.calendar_entries(id) on delete cascade,
 entry_version integer not null, recipient text not null check(recipient in ('owner','wife')),
 due_at timestamptz not null, status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')),
 attempts integer not null default 0, lease_until timestamptz, sent_at timestamptz,
 unique(entry_id,entry_version,recipient)
);
create index if not exists calendar_due on public.calendar_reminders(due_at) where status in ('pending','sending');
alter table public.calendar_entries enable row level security;
alter table public.calendar_reminders enable row level security;
revoke all on public.calendar_entries,public.calendar_reminders from public,anon,authenticated;
grant all on public.calendar_entries,public.calendar_reminders to service_role;

create or replace function public.save_calendar(p_entry jsonb,p_expected integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.calendar_entries; v integer; target text;
begin
 if p_expected is null then v:=1;
 else
  select * into e from public.calendar_entries where id=(p_entry->>'id')::uuid for update;
  if not found or e.version<>p_expected then raise exception 'Changed entry' using errcode='P0002'; end if;
  v:=e.version+1;
 end if;
 insert into public.calendar_entries(id,title,kind,day,member,start_time,end_time,completed,reminder_at,remind_to,version)
 values((p_entry->>'id')::uuid,p_entry->>'title',p_entry->>'kind',(p_entry->>'day')::date,p_entry->>'member',
 (p_entry->>'startTime')::time,(p_entry->>'endTime')::time,(p_entry->>'completed')::boolean,
 (p_entry->>'reminderAt')::timestamptz,p_entry->>'remindTo',v)
 on conflict(id) do update set title=excluded.title,kind=excluded.kind,day=excluded.day,member=excluded.member,
 start_time=excluded.start_time,end_time=excluded.end_time,completed=excluded.completed,
 reminder_at=excluded.reminder_at,remind_to=excluded.remind_to,version=excluded.version,updated_at=now()
 where p_expected is not null and public.calendar_entries.version=p_expected
 returning * into e;
 if not found then raise exception 'Changed entry' using errcode='P0002'; end if;
 update public.calendar_reminders set status='cancelled' where entry_id=e.id and status in ('pending','sending');
 if e.reminder_at is not null and not e.completed then
  for target in select unnest(case e.remind_to when 'both' then array['owner','wife'] else array[e.remind_to] end) loop
   insert into public.calendar_reminders(entry_id,entry_version,recipient,due_at) values(e.id,v,target,e.reminder_at);
  end loop;
 end if;
 return to_jsonb(e)||jsonb_build_object('reminders',(select coalesce(jsonb_agg(jsonb_build_object('recipient',r.recipient,'status',r.status)),'[]'::jsonb) from public.calendar_reminders r where r.entry_id=e.id and r.entry_version=e.version));
end $$;

create or replace function public.read_calendar(p_month text)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('reminders',
  (select coalesce(jsonb_agg(jsonb_build_object('recipient',r.recipient,'status',r.status)),'[]'::jsonb)
   from public.calendar_reminders r where r.entry_id=e.id and r.entry_version=e.version)) order by e.day,e.start_time),'[]'::jsonb)
 from (select * from public.calendar_entries where day >= (p_month||'-01')::date
  and day < (p_month||'-01')::date+interval '1 month' order by day,start_time limit 501) e;
$$;

create or replace function public.claim_calendar_reminders()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare jobs jsonb;
begin
 with due as (
  select r.id from public.calendar_reminders r join public.calendar_entries e on e.id=r.entry_id and e.version=r.entry_version
  where r.due_at<=now() and r.due_at>now()-interval '24 hours' and not e.completed and r.attempts<5
   and (r.status='pending' or (r.status='sending' and r.lease_until<now()))
  order by r.due_at limit 10 for update of r skip locked
 ), claimed as (
  update public.calendar_reminders r set status='sending',attempts=attempts+1,lease_until=now()+interval '10 minutes'
  from due where r.id=due.id returning r.*
 ) select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into jobs from claimed c;
 update public.calendar_reminders set status='failed' where status in ('pending','sending') and (due_at<=now()-interval '24 hours' or (attempts>=5 and (lease_until is null or lease_until<now())));
 return jobs;
end $$;
revoke all on function public.save_calendar(jsonb,integer),public.read_calendar(text),public.claim_calendar_reminders() from public,anon,authenticated;
grant execute on function public.save_calendar(jsonb,integer),public.read_calendar(text),public.claim_calendar_reminders() to service_role;
