create extension if not exists pgcrypto;

create table if not exists public.desk_channel_categories (
  id uuid primary key default gen_random_uuid(),
  desk_id text not null references public.desk_workspaces(desk_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  description text not null default '' check (char_length(description) <= 240),
  position integer not null default 0,
  is_private boolean not null default false,
  read_only boolean not null default false,
  reaction_only boolean not null default false,
  show_history boolean not null default true,
  allowed_user_ids uuid[] not null default array[]::uuid[],
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (desk_id, name)
);

alter table public.desk_channels
  add column if not exists category_id uuid references public.desk_channel_categories(id) on delete cascade;

alter table public.desk_channels
  add column if not exists sync_permissions boolean not null default true;

insert into public.desk_channel_categories (
  desk_id,
  name,
  description,
  position,
  created_by
)
select
  workspace.desk_id,
  'Existing channels',
  'Channels created before the category system was introduced.',
  10,
  workspace.owner_id
from public.desk_workspaces workspace
where exists (
  select 1
  from public.desk_channels channel
  where channel.desk_id = workspace.desk_id
    and channel.category_id is null
)
and not exists (
  select 1
  from public.desk_channel_categories category
  where category.desk_id = workspace.desk_id
    and category.name = 'Existing channels'
);

update public.desk_channels channel
set category_id = category.id
from public.desk_channel_categories category
where channel.category_id is null
  and category.desk_id = channel.desk_id
  and category.name = 'Existing channels';

alter table public.desk_channels
  alter column category_id set not null;

create index if not exists desk_channel_categories_desk_idx
  on public.desk_channel_categories (desk_id, position, created_at);

create index if not exists desk_channels_category_idx
  on public.desk_channels (category_id, position, created_at);

create or replace function public.desk_category_can_view(requested_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.desk_channel_categories category
    join public.desk_members member
      on member.desk_id = category.desk_id
      and member.user_id = auth.uid()
    where category.id = requested_category_id
      and (
        category.is_private = false
        or member.role in ('owner', 'moderator')
        or auth.uid() = any(category.allowed_user_ids)
      )
  );
$$;

create or replace function public.desk_apply_category_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent public.desk_channel_categories%rowtype;
begin
  if new.category_id is null then
    raise exception 'A Desk channel must belong to a category.';
  end if;
  select * into parent
  from public.desk_channel_categories category
  where category.id = new.category_id
    and category.desk_id = new.desk_id;
  if not found then
    raise exception 'The selected category does not belong to this Desk.';
  end if;
  if new.sync_permissions then
    new.is_private := parent.is_private;
    new.read_only := parent.read_only;
    new.reaction_only := parent.reaction_only;
    new.show_history := parent.show_history;
    new.allowed_user_ids := parent.allowed_user_ids;
  end if;
  return new;
end;
$$;

drop trigger if exists desk_channels_apply_category_permissions on public.desk_channels;
create trigger desk_channels_apply_category_permissions
before insert or update of category_id, sync_permissions, is_private, read_only, reaction_only, show_history, allowed_user_ids
on public.desk_channels
for each row execute function public.desk_apply_category_permissions();

create or replace function public.desk_sync_category_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.desk_channels
  set
    is_private = new.is_private,
    read_only = new.read_only,
    reaction_only = new.reaction_only,
    show_history = new.show_history,
    allowed_user_ids = new.allowed_user_ids,
    updated_at = now()
  where category_id = new.id
    and sync_permissions = true;
  return new;
end;
$$;

drop trigger if exists desk_categories_sync_children on public.desk_channel_categories;
create trigger desk_categories_sync_children
after update of is_private, read_only, reaction_only, show_history, allowed_user_ids
on public.desk_channel_categories
for each row execute function public.desk_sync_category_children();

alter table public.desk_channel_categories enable row level security;

revoke all on table public.desk_channel_categories from anon;
grant select, insert, update, delete on table public.desk_channel_categories to authenticated;

revoke all on function public.desk_category_can_view(uuid) from public;
grant execute on function public.desk_category_can_view(uuid) to authenticated;

drop policy if exists "Members read permitted Desk categories" on public.desk_channel_categories;
create policy "Members read permitted Desk categories"
  on public.desk_channel_categories for select to authenticated
  using (public.desk_category_can_view(id));

drop policy if exists "Desk leaders create categories" on public.desk_channel_categories;
create policy "Desk leaders create categories"
  on public.desk_channel_categories for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.desk_has_role(desk_id, array['owner', 'moderator'])
  );

drop policy if exists "Desk leaders update categories" on public.desk_channel_categories;
create policy "Desk leaders update categories"
  on public.desk_channel_categories for update to authenticated
  using (public.desk_has_role(desk_id, array['owner', 'moderator']))
  with check (public.desk_has_role(desk_id, array['owner', 'moderator']));

drop policy if exists "Desk leaders delete categories" on public.desk_channel_categories;
create policy "Desk leaders delete categories"
  on public.desk_channel_categories for delete to authenticated
  using (public.desk_has_role(desk_id, array['owner', 'moderator']));

create or replace function public.desk_create_workspace(
  requested_name text,
  requested_description text,
  requested_objective text,
  requested_weekly_mission text,
  requested_markets text[],
  requested_session text,
  requested_timezone text,
  requested_privacy text,
  requested_capacity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  created_desk_id text := 'desk:' || gen_random_uuid()::text;
  clean_name text := btrim(coalesce(requested_name, ''));
  clean_privacy text := upper(btrim(coalesce(requested_privacy, 'REQUEST')));
  workspace_row public.desk_workspaces%rowtype;
  member_row public.desk_members%rowtype;
begin
  if viewer_id is null then raise exception 'Authentication required.'; end if;
  if char_length(clean_name) < 3 or char_length(clean_name) > 60 then
    raise exception 'A Desk name must contain 3 to 60 characters.';
  end if;
  if not public.desk_name_available(clean_name, null) then
    raise exception 'This Desk already exists.' using errcode = '23505';
  end if;
  if clean_privacy not in ('PUBLIC', 'REQUEST', 'PRIVATE') then clean_privacy := 'REQUEST'; end if;

  insert into public.desk_workspaces (
    desk_id, owner_id, name, description, objective, weekly_mission,
    markets, session, timezone, privacy, capacity
  ) values (
    created_desk_id,
    viewer_id,
    clean_name,
    left(btrim(coalesce(requested_description, '')), 600),
    left(btrim(coalesce(requested_objective, '')), 500),
    left(btrim(coalesce(requested_weekly_mission, '')), 500),
    coalesce(requested_markets, array[]::text[]),
    left(coalesce(nullif(btrim(requested_session), ''), 'New York'), 40),
    left(coalesce(nullif(btrim(requested_timezone), ''), 'UTC'), 80),
    clean_privacy,
    least(50, greatest(2, coalesce(requested_capacity, 12)))
  ) returning * into workspace_row;

  insert into public.desk_members (desk_id, user_id, role)
  values (created_desk_id, viewer_id, 'owner')
  returning * into member_row;

  return jsonb_build_object(
    'workspace', to_jsonb(workspace_row),
    'member', to_jsonb(member_row),
    'channels', '[]'::jsonb
  );
end;
$$;

revoke all on function public.desk_create_workspace(text, text, text, text, text[], text, text, text, integer) from public;
grant execute on function public.desk_create_workspace(text, text, text, text, text[], text, text, text, integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.desk_channel_categories;
exception
  when duplicate_object then null;
end $$;
