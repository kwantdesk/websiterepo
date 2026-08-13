create table if not exists public.chart_drawings (
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument text not null,
  drawings jsonb not null default '[]'::jsonb,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, instrument),
  constraint chart_drawings_instrument_length check (char_length(instrument) between 1 and 40),
  constraint chart_drawings_payload_size check (octet_length(drawings::text) <= 1000000)
);

alter table public.chart_drawings enable row level security;
revoke all on table public.chart_drawings from anon;
grant select, insert, update, delete on table public.chart_drawings to authenticated;

drop policy if exists "Users read their own chart drawings" on public.chart_drawings;
create policy "Users read their own chart drawings" on public.chart_drawings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users create their own chart drawings" on public.chart_drawings;
create policy "Users create their own chart drawings" on public.chart_drawings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update their own chart drawings" on public.chart_drawings;
create policy "Users update their own chart drawings" on public.chart_drawings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete their own chart drawings" on public.chart_drawings;
create policy "Users delete their own chart drawings" on public.chart_drawings
  for delete to authenticated using (auth.uid() = user_id);
