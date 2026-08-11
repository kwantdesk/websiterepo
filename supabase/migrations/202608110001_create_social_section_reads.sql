create table if not exists public.social_section_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (section in ('feed', 'desks')),
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, section)
);

create index if not exists social_section_reads_user_idx
  on public.social_section_reads (user_id, section, last_read_at desc);

alter table public.social_section_reads enable row level security;

revoke all on table public.social_section_reads from anon;
grant select, insert, update on table public.social_section_reads to authenticated;

drop policy if exists "Users read their own social section state" on public.social_section_reads;
create policy "Users read their own social section state"
  on public.social_section_reads
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users create their own social section state" on public.social_section_reads;
create policy "Users create their own social section state"
  on public.social_section_reads
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their own social section state" on public.social_section_reads;
create policy "Users update their own social section state"
  on public.social_section_reads
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

