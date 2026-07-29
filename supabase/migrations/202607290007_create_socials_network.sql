create table if not exists public.social_objects (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  author_label text not null default 'Kwant Trader',
  object_type text not null check (
    object_type in (
      'profile',
      'post',
      'precord',
      'receipt',
      'receipt-evidence',
      'desk',
      'desk-member',
      'comment',
      'reaction',
      'follow',
      'card',
      'progress',
      'consensus'
    )
  ),
  scope text not null default 'private' check (scope in ('private', 'friends', 'desk', 'community')),
  desk_id text,
  parent_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint social_objects_payload_size check (octet_length(payload::text) <= 3000000)
);

create index if not exists social_objects_feed_idx
  on public.social_objects (object_type, created_at desc);

create index if not exists social_objects_user_type_idx
  on public.social_objects (user_id, object_type, created_at desc);

create index if not exists social_objects_desk_idx
  on public.social_objects (desk_id, object_type, created_at desc)
  where desk_id is not null;

create index if not exists social_objects_parent_idx
  on public.social_objects (parent_id, object_type, created_at)
  where parent_id is not null;

alter table public.social_objects enable row level security;

revoke all on table public.social_objects from anon;
grant select, insert, update, delete on table public.social_objects to authenticated;

create or replace function public.socials_is_desk_member(requested_desk_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_objects member
    where member.object_type = 'desk-member'
      and member.desk_id = requested_desk_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.socials_is_friend(profile_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_objects outgoing
    join public.social_objects incoming
      on incoming.object_type = 'follow'
      and incoming.user_id = profile_user_id
      and incoming.payload ->> 'targetUserId' = auth.uid()::text
    where outgoing.object_type = 'follow'
      and outgoing.user_id = auth.uid()
      and outgoing.payload ->> 'targetUserId' = profile_user_id::text
  );
$$;

create or replace function public.socials_can_join_desk(requested_desk_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_objects desk
    where desk.object_type = 'desk'
      and desk.id = requested_desk_id
      and (
        desk.user_id = auth.uid()
        or (
          desk.scope = 'community'
          and desk.payload ->> 'privacy' = 'REQUEST'
        )
      )
  );
$$;

revoke all on function public.socials_is_desk_member(text) from public;
revoke all on function public.socials_is_friend(uuid) from public;
revoke all on function public.socials_can_join_desk(text) from public;
grant execute on function public.socials_is_desk_member(text) to authenticated;
grant execute on function public.socials_is_friend(uuid) to authenticated;
grant execute on function public.socials_can_join_desk(text) to authenticated;

drop policy if exists "Authenticated users read permitted social objects" on public.social_objects;
create policy "Authenticated users read permitted social objects"
  on public.social_objects
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or scope = 'community'
    or (scope = 'desk' and desk_id is not null and public.socials_is_desk_member(desk_id))
    or (scope = 'friends' and public.socials_is_friend(user_id))
  );

drop policy if exists "Users create their own social objects" on public.social_objects;
create policy "Users create their own social objects"
  on public.social_objects
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      scope <> 'desk'
      or (desk_id is not null and public.socials_is_desk_member(desk_id))
      or (
        object_type = 'desk-member'
        and desk_id is not null
        and public.socials_can_join_desk(desk_id)
      )
    )
  );

drop policy if exists "Users update their own social objects" on public.social_objects;
create policy "Users update their own social objects"
  on public.social_objects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their own social objects" on public.social_objects;
create policy "Users delete their own social objects"
  on public.social_objects
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.protect_locked_social_precord()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.object_type = 'precord' then
    raise exception 'Locked Precords are immutable. Add a receipt or amendment instead.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists protect_locked_social_precord_trigger on public.social_objects;
create trigger protect_locked_social_precord_trigger
before update on public.social_objects
for each row execute function public.protect_locked_social_precord();

create or replace function public.enforce_social_desk_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  capacity integer;
begin
  if new.object_type <> 'desk-member' or new.desk_id is null then
    return new;
  end if;

  select count(*)
    into current_members
  from public.social_objects member
  where member.object_type = 'desk-member'
    and member.desk_id = new.desk_id;

  select least(12, greatest(2, coalesce((desk.payload ->> 'capacity')::integer, 12)))
    into capacity
  from public.social_objects desk
  where desk.object_type = 'desk'
    and desk.id = new.desk_id
  order by desk.created_at asc
  limit 1;

  if capacity is null then
    raise exception 'The selected Desk does not exist.';
  end if;

  if current_members >= capacity then
    raise exception 'This Desk is full.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_social_desk_capacity_trigger on public.social_objects;
create trigger enforce_social_desk_capacity_trigger
before insert on public.social_objects
for each row execute function public.enforce_social_desk_capacity();

do $$
begin
  alter publication supabase_realtime add table public.social_objects;
exception
  when duplicate_object then null;
end
$$;
