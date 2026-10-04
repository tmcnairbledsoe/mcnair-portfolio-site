-- Apply once (safe to reapply) in the root-owned Supabase FREE project's SQL editor.
-- No Entra user signs into Supabase. Only the API service role reaches these tables.
begin;
create table if not exists public.assets (
  id uuid primary key,
  namespace text not null,
  kind text not null check (kind in ('blog','journal')),
  owner_tid uuid not null,
  owner_oid uuid not null,
  storage_path text not null unique,
  mime text not null check (mime in ('image/jpeg','image/png','image/webp')),
  size integer not null check (size between 1 and 5242880),
  created_at timestamptz not null default now(),
  check ((kind = 'blog' and namespace = 'blog') or (kind = 'journal' and namespace = 'journal:' || owner_tid::text || ':' || owner_oid::text)),
  check (storage_path = namespace || '/' || id::text)
);
create table if not exists public.posts (
  id uuid primary key,
  namespace text not null,
  kind text not null check (kind in ('blog','journal')),
  owner_tid uuid not null,
  owner_oid uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  document jsonb not null check (coalesce(jsonb_typeof(document) = 'object' and document @> '{"type":"doc"}'::jsonb and jsonb_typeof(document->'content') = 'array' and octet_length(document::text) <= 250000, false)),
  status text not null check (status in ('draft','published','private')),
  asset_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  check ((kind = 'blog' and namespace = 'blog' and status in ('draft','published')) or (kind = 'journal' and namespace = 'journal:' || owner_tid::text || ':' || owner_oid::text and status = 'private'))
);
create index if not exists posts_namespace_date on public.posts(namespace, created_at desc, id desc);
create index if not exists posts_published_feed on public.posts(created_at desc, id desc) where namespace = 'blog' and status = 'published';
create index if not exists posts_asset_references on public.posts using gin(asset_ids);
create index if not exists assets_namespace on public.assets(namespace, id);
alter table public.posts enable row level security;
alter table public.assets enable row level security;
-- These new tables intentionally have NO client RLS policies.
revoke all on public.posts, public.assets from public, anon, authenticated;
grant select, insert, update, delete on public.posts, public.assets to service_role;

-- Transactional asset validation and optimistic update: no read/modify/write gap.
-- SECURITY INVOKER; callable only by server service_role. Identity arguments come
-- exclusively from the verified Entra access token, never from a request body.
create or replace function public.save_content_post(p_post jsonb, p_expected integer default null)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  saved public.posts;
  previous public.posts;
  asset public.assets;
  asset_id uuid;
  ids uuid[];
  ns text := p_post->>'namespace';
  k text := p_post->>'kind';
  tid uuid := (p_post->>'owner_tid')::uuid;
  oid uuid := (p_post->>'owner_oid')::uuid;
  post_id uuid := (p_post->>'id')::uuid;
begin
  if not ((k = 'blog' and ns = 'blog') or (k = 'journal' and ns = 'journal:' || tid::text || ':' || oid::text)) then
    raise exception 'Invalid namespace' using errcode = '22023';
  end if;
  select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(p_post->'asset_ids');
  foreach asset_id in array ids loop
    select * into asset from public.assets where id = asset_id and namespace = ns and kind = k for share;
    if not found or (k = 'journal' and (asset.owner_tid <> tid or asset.owner_oid <> oid)) then
      raise exception 'Invalid asset' using errcode = '22023';
    end if;
  end loop;
  if p_expected is null then
    insert into public.posts(id, namespace, kind, owner_tid, owner_oid, title, document, status, asset_ids)
    values(post_id, ns, k, tid, oid, p_post->>'title', p_post->'document', p_post->>'status', ids) returning * into saved;
  else
    select * into previous from public.posts where id = post_id and namespace = ns and kind = k
      and (k = 'blog' or (owner_tid = tid and owner_oid = oid)) for update;
    if not found or previous.version <> p_expected then
      raise exception 'Conflict' using errcode = 'P0002';
    end if;
    update public.posts set title = p_post->>'title', document = p_post->'document', status = p_post->>'status',
      asset_ids = ids, version = version + 1, updated_at = now()
      where id = post_id and namespace = ns and kind = k and version = p_expected
        and (k = 'blog' or (owner_tid = tid and owner_oid = oid)) returning * into saved;
  end if;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_content_post(jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_content_post(jsonb, integer) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-images', 'portfolio-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- A restrictive deny protects this bucket even if the project has permissive
-- policies for other buckets. Service role bypasses RLS; client roles cannot.
drop policy if exists portfolio_images_server_only on storage.objects;
create policy portfolio_images_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'portfolio-images')
  with check (bucket_id <> 'portfolio-images');
commit;
