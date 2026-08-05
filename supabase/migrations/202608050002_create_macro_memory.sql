create extension if not exists pgcrypto;

create table if not exists public.macro_memory_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  record_type text not null check (record_type in ('CALENDAR', 'DEVELOPMENT', 'RECEIPT')),
  title text not null,
  summary text not null default '',
  topic text not null default 'OTHER',
  status text not null default 'MONITORING',
  impact text not null default '',
  currency text not null default 'USD',
  occurred_at timestamptz not null,
  source_url text not null default '',
  source_title text not null default '',
  publisher text not null default '',
  official boolean not null default false,
  symbols text[] not null default array[]::text[],
  attributes jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(publisher, ''))
  ) stored
);

create index if not exists macro_memory_events_occurred_idx
  on public.macro_memory_events (occurred_at desc);
create index if not exists macro_memory_events_topic_idx
  on public.macro_memory_events (topic, occurred_at desc);
create index if not exists macro_memory_events_symbols_idx
  on public.macro_memory_events using gin (symbols);
create index if not exists macro_memory_events_search_idx
  on public.macro_memory_events using gin (search_document);

create table if not exists public.macro_memory_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  event_key text references public.macro_memory_events(event_key) on delete cascade,
  title text not null,
  summary text not null default '',
  url text not null,
  publisher text not null default '',
  published_at timestamptz not null,
  official boolean not null default false,
  attributes jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists macro_memory_sources_published_idx
  on public.macro_memory_sources (published_at desc);
create index if not exists macro_memory_sources_event_idx
  on public.macro_memory_sources (event_key);

create table if not exists public.macro_market_reactions (
  id uuid primary key default gen_random_uuid(),
  reaction_key text not null unique,
  event_key text not null references public.macro_memory_events(event_key) on delete cascade,
  symbol text not null,
  horizon_minutes integer not null,
  points numeric not null,
  percent numeric not null,
  direction text not null,
  measured_at timestamptz not null,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists macro_market_reactions_event_idx
  on public.macro_market_reactions (event_key, symbol, horizon_minutes);

create table if not exists public.macro_reasoning_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_key text not null unique,
  event_key text not null references public.macro_memory_events(event_key) on delete cascade,
  scenario_observed text not null default '',
  market_response text not null default '',
  got_right text[] not null default array[]::text[],
  missed text[] not null default array[]::text[],
  reasoning_score numeric,
  score_explanation text not null default '',
  evidence_status text not null default '',
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists macro_reasoning_receipts_event_idx
  on public.macro_reasoning_receipts (event_key);

create table if not exists public.macro_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_key text not null unique,
  briefing_date date not null,
  scope text not null default 'GLOBAL',
  generated_at timestamptz not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists macro_daily_briefs_date_idx
  on public.macro_daily_briefs (briefing_date desc, scope);

create table if not exists public.macro_ingestion_state (
  id text primary key,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text not null default 'IDLE',
  details jsonb not null default '{}'::jsonb
);

alter table public.macro_memory_events enable row level security;
alter table public.macro_memory_sources enable row level security;
alter table public.macro_market_reactions enable row level security;
alter table public.macro_reasoning_receipts enable row level security;
alter table public.macro_daily_briefs enable row level security;
alter table public.macro_ingestion_state enable row level security;

revoke all on table public.macro_memory_events from anon;
revoke all on table public.macro_memory_sources from anon;
revoke all on table public.macro_market_reactions from anon;
revoke all on table public.macro_reasoning_receipts from anon;
revoke all on table public.macro_daily_briefs from anon;
revoke all on table public.macro_ingestion_state from anon;
grant select on table public.macro_memory_events to authenticated;
grant select on table public.macro_memory_sources to authenticated;
grant select on table public.macro_market_reactions to authenticated;
grant select on table public.macro_reasoning_receipts to authenticated;
grant select on table public.macro_daily_briefs to authenticated;
grant all on table public.macro_memory_events to service_role;
grant all on table public.macro_memory_sources to service_role;
grant all on table public.macro_market_reactions to service_role;
grant all on table public.macro_reasoning_receipts to service_role;
grant all on table public.macro_daily_briefs to service_role;
grant all on table public.macro_ingestion_state to service_role;

create or replace function public.claim_macro_ingestion(minimum_interval_seconds integer default 240)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  insert into public.macro_ingestion_state (id, last_status)
  values ('global', 'IDLE')
  on conflict (id) do nothing;

  update public.macro_ingestion_state
  set last_started_at = now(), last_status = 'RUNNING'
  where id = 'global'
    and (
      last_started_at is null
      or last_started_at < now() - make_interval(secs => greatest(30, minimum_interval_seconds))
      or last_status in ('FAILED', 'IDLE')
    );
  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.claim_macro_ingestion(integer) from public;
grant execute on function public.claim_macro_ingestion(integer) to service_role;

drop policy if exists "Authenticated users read macro events" on public.macro_memory_events;
create policy "Authenticated users read macro events" on public.macro_memory_events
  for select to authenticated using (true);
drop policy if exists "Authenticated users read macro sources" on public.macro_memory_sources;
create policy "Authenticated users read macro sources" on public.macro_memory_sources
  for select to authenticated using (true);
drop policy if exists "Authenticated users read macro reactions" on public.macro_market_reactions;
create policy "Authenticated users read macro reactions" on public.macro_market_reactions
  for select to authenticated using (true);
drop policy if exists "Authenticated users read macro receipts" on public.macro_reasoning_receipts;
create policy "Authenticated users read macro receipts" on public.macro_reasoning_receipts
  for select to authenticated using (true);
drop policy if exists "Authenticated users read macro briefs" on public.macro_daily_briefs;
create policy "Authenticated users read macro briefs" on public.macro_daily_briefs
  for select to authenticated using (true);

create or replace function public.search_macro_memory(
  search_text text default '',
  from_time timestamptz default now() - interval '7 days',
  to_time timestamptz default now(),
  requested_symbol text default null,
  result_limit integer default 20
)
returns table (
  event_key text,
  record_type text,
  title text,
  summary text,
  topic text,
  status text,
  impact text,
  occurred_at timestamptz,
  source_url text,
  publisher text,
  official boolean,
  symbols text[],
  attributes jsonb,
  relevance real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event.event_key,
    event.record_type,
    event.title,
    event.summary,
    event.topic,
    event.status,
    event.impact,
    event.occurred_at,
    event.source_url,
    event.publisher,
    event.official,
    event.symbols,
    event.attributes,
    (
      case
        when nullif(btrim(search_text), '') is null then 0
        else ts_rank_cd(event.search_document, websearch_to_tsquery('english', search_text))
      end
      + case when event.official then 0.15 else 0 end
      + greatest(0, 0.20 - extract(epoch from (now() - event.occurred_at)) / 604800.0 * 0.20)
    )::real as relevance
  from public.macro_memory_events event
  where event.occurred_at between from_time and to_time
    and (requested_symbol is null or requested_symbol = any(event.symbols))
    and (
      nullif(btrim(search_text), '') is null
      or event.search_document @@ websearch_to_tsquery('english', search_text)
    )
  order by relevance desc, event.occurred_at desc
  limit greatest(1, least(coalesce(result_limit, 20), 50));
$$;

revoke all on function public.search_macro_memory(text, timestamptz, timestamptz, text, integer) from public;
grant execute on function public.search_macro_memory(text, timestamptz, timestamptz, text, integer) to authenticated;
grant execute on function public.search_macro_memory(text, timestamptz, timestamptz, text, integer) to service_role;
