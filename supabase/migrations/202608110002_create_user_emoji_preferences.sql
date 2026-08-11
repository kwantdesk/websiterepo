create table if not exists public.user_emoji_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_emoji_preferences_size check (octet_length(usage::text) <= 20000)
);

alter table public.user_emoji_preferences enable row level security;
revoke all on table public.user_emoji_preferences from anon;
grant select, insert, update on table public.user_emoji_preferences to authenticated;

drop policy if exists "Users read their own emoji preferences" on public.user_emoji_preferences;
create policy "Users read their own emoji preferences" on public.user_emoji_preferences
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users create their own emoji preferences" on public.user_emoji_preferences;
create policy "Users create their own emoji preferences" on public.user_emoji_preferences
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update their own emoji preferences" on public.user_emoji_preferences;
create policy "Users update their own emoji preferences" on public.user_emoji_preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

