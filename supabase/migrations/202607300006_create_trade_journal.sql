create table if not exists public.journal_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  source text not null default 'import' check (source in ('import', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint journal_accounts_name_length check (char_length(name) between 1 and 80)
);

create table if not exists public.journal_trades (
  user_id uuid not null,
  id text not null,
  account_id text not null,
  source_import_id text not null,
  opened_at timestamptz not null,
  closed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, account_id)
    references public.journal_accounts(user_id, id)
    on delete cascade,
  constraint journal_trade_payload_size check (octet_length(payload::text) <= 250000)
);

create table if not exists public.journal_imports (
  user_id uuid not null,
  id text not null,
  account_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, account_id)
    references public.journal_accounts(user_id, id)
    on delete cascade,
  constraint journal_import_payload_size check (octet_length(payload::text) <= 250000)
);

create index if not exists journal_trades_account_date_idx
  on public.journal_trades (user_id, account_id, closed_at desc nulls last, opened_at desc);

create index if not exists journal_trades_import_idx
  on public.journal_trades (user_id, source_import_id);

create index if not exists journal_imports_account_idx
  on public.journal_imports (user_id, account_id, created_at desc);

alter table public.journal_accounts enable row level security;
alter table public.journal_trades enable row level security;
alter table public.journal_imports enable row level security;

revoke all on table public.journal_accounts from anon;
revoke all on table public.journal_trades from anon;
revoke all on table public.journal_imports from anon;

grant select, insert, update, delete on table public.journal_accounts to authenticated;
grant select, insert, update, delete on table public.journal_trades to authenticated;
grant select, insert, update, delete on table public.journal_imports to authenticated;

drop policy if exists "Users manage their own journal accounts" on public.journal_accounts;
create policy "Users manage their own journal accounts"
  on public.journal_accounts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own journal trades" on public.journal_trades;
create policy "Users manage their own journal trades"
  on public.journal_trades
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own journal imports" on public.journal_imports;
create policy "Users manage their own journal imports"
  on public.journal_imports
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_trade_journal_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_journal_accounts_updated_at on public.journal_accounts;
create trigger touch_journal_accounts_updated_at
before update on public.journal_accounts
for each row execute function public.touch_trade_journal_updated_at();

drop trigger if exists touch_journal_trades_updated_at on public.journal_trades;
create trigger touch_journal_trades_updated_at
before update on public.journal_trades
for each row execute function public.touch_trade_journal_updated_at();
