create table if not exists public.kwantbot_messages (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  root text not null check (root in ('NQ', 'ES')),
  kind text not null check (kind in ('system', 'briefing', 'approach', 'touch', 'rejection', 'acceptance', 'outcome', 'options')),
  level_id text,
  created_at timestamptz not null,
  payload jsonb not null,
  archived_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists kwantbot_messages_user_root_created_idx
  on public.kwantbot_messages (user_id, root, created_at desc);

create table if not exists public.kwantbot_memory_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  root text not null check (root in ('NQ', 'ES')),
  event_type text not null check (event_type in ('price', 'context', 'approach', 'touch', 'rejection', 'acceptance', 'outcome')),
  level_id text,
  created_at timestamptz not null,
  payload jsonb not null,
  archived_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists kwantbot_memory_events_user_root_created_idx
  on public.kwantbot_memory_events (user_id, root, created_at desc);

create index if not exists kwantbot_memory_events_user_type_created_idx
  on public.kwantbot_memory_events (user_id, event_type, created_at desc);

create table if not exists public.kwantbot_context_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  root text not null check (root in ('NQ', 'ES')),
  snapshot_key text not null,
  generated_at timestamptz not null,
  payload jsonb not null,
  archived_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, root, snapshot_key)
);

create index if not exists kwantbot_context_snapshots_user_root_generated_idx
  on public.kwantbot_context_snapshots (user_id, root, generated_at desc);

alter table public.kwantbot_messages enable row level security;
alter table public.kwantbot_memory_events enable row level security;
alter table public.kwantbot_context_snapshots enable row level security;

drop policy if exists "Users read their KwantBot messages" on public.kwantbot_messages;
create policy "Users read their KwantBot messages"
  on public.kwantbot_messages for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert their KwantBot messages" on public.kwantbot_messages;
create policy "Users insert their KwantBot messages"
  on public.kwantbot_messages for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their KwantBot messages" on public.kwantbot_messages;
create policy "Users update their KwantBot messages"
  on public.kwantbot_messages for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users read their KwantBot memory" on public.kwantbot_memory_events;
create policy "Users read their KwantBot memory"
  on public.kwantbot_memory_events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert their KwantBot memory" on public.kwantbot_memory_events;
create policy "Users insert their KwantBot memory"
  on public.kwantbot_memory_events for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their KwantBot memory" on public.kwantbot_memory_events;
create policy "Users update their KwantBot memory"
  on public.kwantbot_memory_events for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users read their KwantBot contexts" on public.kwantbot_context_snapshots;
create policy "Users read their KwantBot contexts"
  on public.kwantbot_context_snapshots for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert their KwantBot contexts" on public.kwantbot_context_snapshots;
create policy "Users insert their KwantBot contexts"
  on public.kwantbot_context_snapshots for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their KwantBot contexts" on public.kwantbot_context_snapshots;
create policy "Users update their KwantBot contexts"
  on public.kwantbot_context_snapshots for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
