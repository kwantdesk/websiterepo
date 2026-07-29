create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{"version":1,"complete":true,"values":{}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

revoke all on table public.user_preferences from anon;
grant select, insert, update, delete on table public.user_preferences to authenticated;

drop policy if exists "Users read their preferences" on public.user_preferences;
create policy "Users read their preferences"
  on public.user_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert their preferences" on public.user_preferences;
create policy "Users insert their preferences"
  on public.user_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their preferences" on public.user_preferences;
create policy "Users update their preferences"
  on public.user_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their preferences" on public.user_preferences;
create policy "Users delete their preferences"
  on public.user_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);
