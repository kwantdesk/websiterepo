create table if not exists public.kwantbot_learning_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  root text not null check (root in ('NQ', 'ES')),
  level_id text,
  level_name text not null,
  score integer not null check (score between 0 and 100),
  verdict text not null check (verdict in ('CONFIRMED', 'PARTIAL', 'FAILED')),
  grade text not null check (grade in ('EXCELLENT', 'GOOD', 'MIXED', 'POOR')),
  reviewed_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists kwantbot_learning_reviews_user_root_reviewed_idx
  on public.kwantbot_learning_reviews (user_id, root, reviewed_at desc);

alter table public.kwantbot_learning_reviews enable row level security;

drop policy if exists "Users read their KwantBot reviews" on public.kwantbot_learning_reviews;
create policy "Users read their KwantBot reviews"
  on public.kwantbot_learning_reviews
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert their KwantBot reviews" on public.kwantbot_learning_reviews;
create policy "Users insert their KwantBot reviews"
  on public.kwantbot_learning_reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their KwantBot reviews" on public.kwantbot_learning_reviews;
create policy "Users update their KwantBot reviews"
  on public.kwantbot_learning_reviews
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
