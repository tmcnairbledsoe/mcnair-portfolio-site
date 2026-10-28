-- Apply once (safe to reapply) in the root-owned Supabase FREE project's SQL editor.
-- Commander chat is reachable only through the Owner-only API and the private relay.
-- No Entra user signs into Supabase; only the API service role reaches these tables.
begin;

-- One row per chat turn. The browser never touches this table directly: the
-- Functions API verifies the Owner role on every request, and the home relay
-- uses a separate server-to-server secret.
create table if not exists public.infinity_messages (
  id uuid primary key,
  seq bigint generated always as identity unique,
  owner_tid uuid not null,
  owner_oid uuid not null,
  client_id uuid,
  role text not null check (role in ('user','assistant')),
  body text not null check (length(btrim(body)) between 1 and 32000),
  reply_to uuid references public.infinity_messages(id),
  state text not null check (state in ('queued','working','waiting','answered','failed')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  -- Only a reply can point at an earlier turn, and a reply is always final.
  check ((role = 'assistant') = (reply_to is not null)),
  check (role = 'user' or state in ('answered','failed'))
);
-- Retrying the same browser send must not duplicate the prompt.
create unique index if not exists infinity_messages_client
  on public.infinity_messages(owner_oid, client_id) where client_id is not null;
-- At most one reply per prompt, so a retried relay delivery is idempotent.
create unique index if not exists infinity_messages_reply
  on public.infinity_messages(reply_to) where reply_to is not null;
create index if not exists infinity_messages_owner_seq
  on public.infinity_messages(owner_oid, seq);
create index if not exists infinity_messages_pending
  on public.infinity_messages(seq) where role = 'user' and state = 'queued';

-- Single row: when the home PC last reached the relay. Lets the page say
-- whether Commander is actually online instead of implying it.
create table if not exists public.infinity_relay (
  id text primary key,
  last_seen_at timestamptz not null default now()
);

alter table public.infinity_messages enable row level security;
alter table public.infinity_relay enable row level security;
-- These tables intentionally have NO client RLS policies.
revoke all on public.infinity_messages, public.infinity_relay from public, anon, authenticated;
grant select, insert, update, delete on public.infinity_messages, public.infinity_relay to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
