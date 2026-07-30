create table if not exists public.zyon_gameplan_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  session_date date not null,
  root text not null check (root in ('NQ', 'ES')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  source_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint zyon_gameplan_drafts_payload_size check (octet_length(payload::text) <= 120000)
);

create index if not exists zyon_gameplan_drafts_latest_idx
  on public.zyon_gameplan_drafts (user_id, session_date desc, updated_at desc);

alter table public.zyon_gameplan_drafts enable row level security;

revoke all on table public.zyon_gameplan_drafts from anon;
grant select, insert, update, delete on table public.zyon_gameplan_drafts to authenticated;

drop policy if exists "Users read their ZYON Gameplan drafts" on public.zyon_gameplan_drafts;
create policy "Users read their ZYON Gameplan drafts"
  on public.zyon_gameplan_drafts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users create their ZYON Gameplan drafts" on public.zyon_gameplan_drafts;
create policy "Users create their ZYON Gameplan drafts"
  on public.zyon_gameplan_drafts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their ZYON Gameplan drafts" on public.zyon_gameplan_drafts;
create policy "Users update their ZYON Gameplan drafts"
  on public.zyon_gameplan_drafts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their ZYON Gameplan drafts" on public.zyon_gameplan_drafts;
create policy "Users delete their ZYON Gameplan drafts"
  on public.zyon_gameplan_drafts
  for delete
  to authenticated
  using (auth.uid() = user_id);
