-- Public canvas, accessed only through the same-origin backend. No client DB grants.
create table if not exists public.drawing_board (
  id integer primary key check (id = 1), generation uuid not null default gen_random_uuid(),
  revision bigint not null default 0, window_at timestamptz not null default now(), writes integer not null default 0
);
insert into public.drawing_board(id) values(1) on conflict do nothing;
create table if not exists public.drawing_strokes (
  id uuid primary key, writer_hash text not null check(length(writer_hash)=64),
  version integer not null, created_seq bigint not null, changed_seq bigint not null,
  deleted boolean not null default false, stroke jsonb not null, updated_at timestamptz not null default now()
);
create index if not exists drawing_changes on public.drawing_strokes(changed_seq);
alter table public.drawing_board enable row level security;
alter table public.drawing_strokes enable row level security;
revoke all on public.drawing_board, public.drawing_strokes from public, anon, authenticated;
grant all on public.drawing_board, public.drawing_strokes to service_role;

create or replace function public.read_drawing(p_after bigint, p_generation uuid, p_writer text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare b public.drawing_board; rows jsonb; last_seq bigint; more boolean; start_seq bigint;
begin
  select * into b from public.drawing_board where id=1 for share;
  start_seq := case when p_generation is distinct from b.generation then 0 else p_after end;
  if start_seq < 0 or start_seq > b.revision then raise exception 'Invalid cursor' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version',s.version,'order',s.created_seq,
    'deleted',s.deleted,'stroke',s.stroke,'mine',s.writer_hash=p_writer) order by s.changed_seq),'[]'::jsonb),max(s.changed_seq)
    into rows,last_seq from (select * from public.drawing_strokes where changed_seq>start_seq order by changed_seq limit 50) s;
  more := exists(select 1 from public.drawing_strokes where changed_seq>coalesce(last_seq,start_seq));
  return jsonb_build_object('generation',b.generation,'reset',p_generation is distinct from b.generation,
    'cursor',case when more then last_seq else b.revision end,'more',more,'items',rows);
end $$;

create or replace function public.write_drawing(p_id uuid,p_writer text,p_version integer,p_stroke jsonb,p_deleted boolean,p_generation uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare b public.drawing_board; s public.drawing_strokes; seq bigint;
begin
  select * into b from public.drawing_board where id=1 for update;
  if b.generation is distinct from p_generation then raise exception 'Canvas cleared' using errcode='P0002'; end if;
  select * into s from public.drawing_strokes where id=p_id;
  if s.id is not null and s.writer_hash<>p_writer then raise exception 'Not your stroke' using errcode='42501'; end if;
  if s.id is not null and (s.version>=p_version or s.deleted) then
    return jsonb_build_object('id',s.id,'version',s.version,'order',s.created_seq,'deleted',s.deleted,'stroke',s.stroke,'mine',true);
  end if;
  if p_version<1 or p_version>2147483646 or length(p_writer)<>64 or jsonb_typeof(p_stroke)<>'object'
    or octet_length(p_stroke::text)>80000 then raise exception 'Invalid stroke' using errcode='22023'; end if;
  if s.id is null and (select count(*) from public.drawing_strokes)>=2000 then
    raise exception 'Canvas full or missing stroke' using errcode='54000'; end if;
  if b.window_at<now()-interval '10 seconds' then b.window_at:=now(); b.writes:=0; end if;
  if b.writes>=200 then raise exception 'Slow down' using errcode='53300'; end if;
  seq:=b.revision+1;
  update public.drawing_board set revision=seq,window_at=b.window_at,writes=b.writes+1 where id=1;
  insert into public.drawing_strokes(id,writer_hash,version,created_seq,changed_seq,deleted,stroke)
    values(p_id,p_writer,p_version,seq,seq,p_deleted,p_stroke)
    on conflict(id) do update set version=p_version,changed_seq=seq,deleted=p_deleted,stroke=p_stroke,updated_at=now()
    returning * into s;
  return jsonb_build_object('id',s.id,'version',s.version,'order',s.created_seq,'deleted',s.deleted,'stroke',s.stroke,'mine',true);
end $$;

-- Called by the backend only after verifying OwnerRole.
create or replace function public.clear_drawing(p_generation uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.drawing_board where id=1 and generation=p_generation for update;
  if not found then raise exception 'Canvas changed' using errcode='P0002'; end if;
  delete from public.drawing_strokes;
  update public.drawing_board set generation=gen_random_uuid(),revision=0,writes=0,window_at=now() where id=1;
end $$;
revoke all on function public.read_drawing(bigint,uuid,text), public.write_drawing(uuid,text,integer,jsonb,boolean,uuid), public.clear_drawing(uuid) from public,anon,authenticated;
grant execute on function public.read_drawing(bigint,uuid,text), public.write_drawing(uuid,text,integer,jsonb,boolean,uuid), public.clear_drawing(uuid) to service_role;
