create table if not exists public.zyon_journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  session_date date not null,
  root text not null check (root in ('NQ', 'ES')),
  title text not null,
  summary text not null default '',
  body text not null,
  kind text not null check (kind in ('TRADE', 'SETUP', 'REVIEW', 'LESSON', 'NOTE')),
  tags text[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb,
  source text not null default 'zyon-auto',
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists zyon_journal_user_session_idx
  on public.zyon_journal_entries (user_id, session_date desc, created_at desc);

alter table public.zyon_journal_entries enable row level security;

drop policy if exists "Users read their ZYON journal" on public.zyon_journal_entries;
create policy "Users read their ZYON journal"
  on public.zyon_journal_entries
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert their ZYON journal" on public.zyon_journal_entries;
create policy "Users insert their ZYON journal"
  on public.zyon_journal_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their ZYON journal" on public.zyon_journal_entries;
create policy "Users update their ZYON journal"
  on public.zyon_journal_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their ZYON journal" on public.zyon_journal_entries;
create policy "Users delete their ZYON journal"
  on public.zyon_journal_entries
  for delete
  to authenticated
  using (auth.uid() = user_id);
