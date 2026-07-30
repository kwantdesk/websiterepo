create extension if not exists pgcrypto;

create table if not exists public.desk_workspaces (
  desk_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 600),
  objective text not null default '' check (char_length(objective) <= 500),
  weekly_mission text not null default '' check (char_length(weekly_mission) <= 500),
  markets text[] not null default array[]::text[],
  session text not null default 'New York' check (char_length(session) <= 40),
  timezone text not null default 'UTC' check (char_length(timezone) <= 80),
  privacy text not null default 'REQUEST' check (privacy in ('PUBLIC', 'REQUEST', 'PRIVATE')),
  capacity integer not null default 12 check (capacity between 2 and 50),
  allow_member_invites boolean not null default true,
  inactivity_days integer check (inactivity_days is null or inactivity_days between 7 and 365),
  avatar_url text not null default '',
  accent_color text not null default '#d8b45c' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  rules text not null default 'Preparation can be shared. The next decision remains individual.'
    check (char_length(rules) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.desk_members (
  desk_id text not null references public.desk_workspaces(desk_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  primary key (desk_id, user_id)
);

create table if not exists public.desk_join_requests (
  id uuid primary key default gen_random_uuid(),
  desk_id text not null references public.desk_workspaces(desk_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('request', 'invite')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (desk_id, user_id, request_type)
);

create table if not exists public.desk_channels (
  id uuid primary key default gen_random_uuid(),
  desk_id text not null references public.desk_workspaces(desk_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 240),
  channel_type text not null default 'text' check (channel_type in ('text', 'voice')),
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

create table if not exists public.desk_messages (
  id uuid primary key default gen_random_uuid(),
  desk_id text not null references public.desk_workspaces(desk_id) on delete cascade,
  channel_id uuid not null references public.desk_channels(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint desk_message_content check (
    char_length(trim(body)) > 0 or jsonb_array_length(attachments) > 0
  ),
  constraint desk_message_attachment_size check (
    octet_length(attachments::text) <= 1800000
  )
);

create table if not exists public.desk_message_reactions (
  message_id uuid not null references public.desk_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists desk_members_user_idx
  on public.desk_members (user_id, joined_at desc);
create index if not exists desk_join_requests_user_idx
  on public.desk_join_requests (user_id, status, created_at desc);
create index if not exists desk_join_requests_desk_idx
  on public.desk_join_requests (desk_id, status, created_at desc);
create index if not exists desk_channels_desk_idx
  on public.desk_channels (desk_id, position, created_at);
create index if not exists desk_messages_channel_idx
  on public.desk_messages (channel_id, created_at desc);
create index if not exists desk_messages_desk_idx
  on public.desk_messages (desk_id, created_at desc);

alter table public.desk_workspaces enable row level security;
alter table public.desk_members enable row level security;
alter table public.desk_join_requests enable row level security;
alter table public.desk_channels enable row level security;
alter table public.desk_messages enable row level security;
alter table public.desk_message_reactions enable row level security;

revoke all on table public.desk_workspaces from anon;
revoke all on table public.desk_members from anon;
revoke all on table public.desk_join_requests from anon;
revoke all on table public.desk_channels from anon;
revoke all on table public.desk_messages from anon;
revoke all on table public.desk_message_reactions from anon;

grant select, insert, update, delete on table public.desk_workspaces to authenticated;
grant select on table public.desk_members to authenticated;
grant select on table public.desk_join_requests to authenticated;
grant select, insert, update, delete on table public.desk_channels to authenticated;
grant select, insert, delete on table public.desk_messages to authenticated;
grant select, insert, delete on table public.desk_message_reactions to authenticated;

create or replace function public.desk_is_member(requested_desk_id text, requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.desk_members member
    where member.desk_id = requested_desk_id
      and member.user_id = requested_user_id
  );
$$;

create or replace function public.desk_has_role(requested_desk_id text, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.desk_members member
    where member.desk_id = requested_desk_id
      and member.user_id = auth.uid()
      and member.role = any(allowed_roles)
  );
$$;

create or replace function public.desk_channel_can_view(requested_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.desk_channels channel
    join public.desk_members member
      on member.desk_id = channel.desk_id
      and member.user_id = auth.uid()
    where channel.id = requested_channel_id
      and (
        channel.is_private = false
        or member.role in ('owner', 'moderator')
        or auth.uid() = any(channel.allowed_user_ids)
      )
  );
$$;

create or replace function public.desk_message_can_view(requested_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.desk_messages message
    join public.desk_channels channel on channel.id = message.channel_id
    join public.desk_members member
      on member.desk_id = message.desk_id
      and member.user_id = auth.uid()
    where message.id = requested_message_id
      and public.desk_channel_can_view(channel.id)
      and (channel.show_history or message.created_at >= member.joined_at)
  );
$$;

revoke all on function public.desk_is_member(text, uuid) from public;
revoke all on function public.desk_has_role(text, text[]) from public;
revoke all on function public.desk_channel_can_view(uuid) from public;
revoke all on function public.desk_message_can_view(uuid) from public;
grant execute on function public.desk_is_member(text, uuid) to authenticated;
grant execute on function public.desk_has_role(text, text[]) to authenticated;
grant execute on function public.desk_channel_can_view(uuid) to authenticated;
grant execute on function public.desk_message_can_view(uuid) to authenticated;

drop policy if exists "Visible Desk workspaces" on public.desk_workspaces;
create policy "Visible Desk workspaces"
  on public.desk_workspaces for select to authenticated
  using (
    privacy <> 'PRIVATE'
    or owner_id = auth.uid()
    or public.desk_is_member(desk_id)
    or exists (
      select 1 from public.desk_join_requests request
      where request.desk_id = desk_workspaces.desk_id
        and request.user_id = auth.uid()
        and request.request_type = 'invite'
        and request.status = 'pending'
    )
  );

drop policy if exists "Owners create Desk workspaces" on public.desk_workspaces;
create policy "Owners create Desk workspaces"
  on public.desk_workspaces for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Owners update Desk workspaces" on public.desk_workspaces;
create policy "Owners update Desk workspaces"
  on public.desk_workspaces for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners delete Desk workspaces" on public.desk_workspaces;
create policy "Owners delete Desk workspaces"
  on public.desk_workspaces for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Visible Desk memberships" on public.desk_members;
create policy "Visible Desk memberships"
  on public.desk_members for select to authenticated
  using (
    public.desk_is_member(desk_id)
    or exists (
      select 1 from public.desk_workspaces workspace
      where workspace.desk_id = desk_members.desk_id
        and workspace.privacy <> 'PRIVATE'
    )
    or user_id = auth.uid()
  );

drop policy if exists "Relevant Desk requests" on public.desk_join_requests;
create policy "Relevant Desk requests"
  on public.desk_join_requests for select to authenticated
  using (
    user_id = auth.uid()
    or requested_by = auth.uid()
    or public.desk_has_role(desk_id, array['owner', 'moderator'])
  );

drop policy if exists "Members read permitted Desk channels" on public.desk_channels;
create policy "Members read permitted Desk channels"
  on public.desk_channels for select to authenticated
  using (public.desk_channel_can_view(id));

drop policy if exists "Desk leaders create channels" on public.desk_channels;
create policy "Desk leaders create channels"
  on public.desk_channels for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.desk_has_role(desk_id, array['owner', 'moderator'])
  );

drop policy if exists "Desk leaders update channels" on public.desk_channels;
create policy "Desk leaders update channels"
  on public.desk_channels for update to authenticated
  using (public.desk_has_role(desk_id, array['owner', 'moderator']))
  with check (public.desk_has_role(desk_id, array['owner', 'moderator']));

drop policy if exists "Desk leaders delete channels" on public.desk_channels;
create policy "Desk leaders delete channels"
  on public.desk_channels for delete to authenticated
  using (public.desk_has_role(desk_id, array['owner', 'moderator']));

drop policy if exists "Members read permitted Desk messages" on public.desk_messages;
create policy "Members read permitted Desk messages"
  on public.desk_messages for select to authenticated
  using (
    public.desk_channel_can_view(channel_id)
    and exists (
      select 1
      from public.desk_channels channel
      join public.desk_members member
        on member.desk_id = channel.desk_id
        and member.user_id = auth.uid()
      where channel.id = desk_messages.channel_id
        and (channel.show_history or desk_messages.created_at >= member.joined_at)
    )
  );

drop policy if exists "Members send permitted Desk messages" on public.desk_messages;
create policy "Members send permitted Desk messages"
  on public.desk_messages for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and public.desk_channel_can_view(channel_id)
    and exists (
      select 1 from public.desk_channels channel
      where channel.id = channel_id
        and channel.desk_id = desk_id
        and channel.channel_type = 'text'
        and (
          (channel.read_only = false and channel.reaction_only = false)
          or public.desk_has_role(desk_id, array['owner', 'moderator'])
        )
    )
  );

drop policy if exists "Authors or leaders delete Desk messages" on public.desk_messages;
create policy "Authors or leaders delete Desk messages"
  on public.desk_messages for delete to authenticated
  using (
    sender_user_id = auth.uid()
    or public.desk_has_role(desk_id, array['owner', 'moderator'])
  );

drop policy if exists "Members read Desk reactions" on public.desk_message_reactions;
create policy "Members read Desk reactions"
  on public.desk_message_reactions for select to authenticated
  using (public.desk_message_can_view(message_id));

drop policy if exists "Members add Desk reactions" on public.desk_message_reactions;
create policy "Members add Desk reactions"
  on public.desk_message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.desk_message_can_view(message_id)
  );

drop policy if exists "Members remove their Desk reactions" on public.desk_message_reactions;
create policy "Members remove their Desk reactions"
  on public.desk_message_reactions for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.sync_desk_member_social_object()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  label text;
begin
  if tg_op = 'DELETE' then
    delete from public.social_objects
    where user_id = old.user_id
      and id = 'desk-member:' || old.desk_id;
    return old;
  end if;

  select coalesce(
    nullif(profile.payload ->> 'displayName', ''),
    nullif(profile.author_label, ''),
    'Kwant Trader'
  )
  into label
  from public.social_objects profile
  where profile.user_id = new.user_id
    and profile.object_type = 'profile'
  order by profile.updated_at desc
  limit 1;

  if exists (
    select 1 from public.social_objects
    where user_id = new.user_id
      and id = 'desk-member:' || new.desk_id
  ) then
    update public.social_objects
    set author_label = coalesce(label, 'Kwant Trader'),
        object_type = 'desk-member',
        scope = 'desk',
        desk_id = new.desk_id,
        parent_id = new.desk_id,
        payload = jsonb_build_object(
          'role', case new.role when 'owner' then 'OWNER' when 'moderator' then 'STEWARD' else 'MEMBER' end,
          'status', 'PREPARING',
          'joinedAt', new.joined_at
        ),
        updated_at = now()
    where user_id = new.user_id
      and id = 'desk-member:' || new.desk_id;
  else
    insert into public.social_objects (
      user_id, id, author_label, object_type, scope, desk_id, parent_id, payload, created_at, updated_at
    ) values (
      new.user_id,
      'desk-member:' || new.desk_id,
      coalesce(label, 'Kwant Trader'),
      'desk-member',
      'desk',
      new.desk_id,
      new.desk_id,
      jsonb_build_object(
        'role', case new.role when 'owner' then 'OWNER' when 'moderator' then 'STEWARD' else 'MEMBER' end,
        'status', 'PREPARING',
        'joinedAt', new.joined_at
      ),
      new.joined_at,
      now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sync_desk_member_social_object_trigger on public.desk_members;
create trigger sync_desk_member_social_object_trigger
after insert or update or delete on public.desk_members
for each row execute function public.sync_desk_member_social_object();

create or replace function public.enforce_desk_member_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  maximum_members integer;
begin
  if exists (
    select 1 from public.desk_members
    where desk_id = new.desk_id and user_id = new.user_id
  ) then
    return new;
  end if;

  select count(*) into current_members
  from public.desk_members
  where desk_id = new.desk_id;

  select capacity into maximum_members
  from public.desk_workspaces
  where desk_id = new.desk_id;

  if maximum_members is null then
    raise exception 'The selected Desk does not exist.';
  end if;
  if current_members >= maximum_members then
    raise exception 'This Desk is full.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_desk_member_capacity_trigger on public.desk_members;
create trigger enforce_desk_member_capacity_trigger
before insert on public.desk_members
for each row execute function public.enforce_desk_member_capacity();

create or replace function public.enforce_social_desk_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  maximum_members integer;
begin
  if new.object_type <> 'desk-member' or new.desk_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.social_objects
    where user_id = new.user_id and id = new.id
  ) then
    return new;
  end if;

  select count(*) into current_members
  from public.social_objects member
  where member.object_type = 'desk-member'
    and member.desk_id = new.desk_id;

  select coalesce(
    (select workspace.capacity from public.desk_workspaces workspace where workspace.desk_id = new.desk_id),
    (select least(50, greatest(2, coalesce((desk.payload ->> 'capacity')::integer, 12)))
      from public.social_objects desk
      where desk.object_type = 'desk' and desk.id = new.desk_id
      order by desk.created_at asc limit 1)
  ) into maximum_members;

  if maximum_members is null then
    raise exception 'The selected Desk does not exist.';
  end if;
  if current_members >= maximum_members then
    raise exception 'This Desk is full.';
  end if;
  return new;
end;
$$;

create or replace function public.desk_request_access(requested_desk_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace public.desk_workspaces%rowtype;
begin
  select * into workspace from public.desk_workspaces where desk_id = requested_desk_id;
  if workspace.desk_id is null then raise exception 'That Desk does not exist.'; end if;
  if public.desk_is_member(requested_desk_id) then return 'member'; end if;
  if workspace.owner_id = auth.uid() then
    insert into public.desk_members (desk_id, user_id, role)
    values (requested_desk_id, auth.uid(), 'owner')
    on conflict (desk_id, user_id) do update set role = 'owner';
    return 'owner';
  end if;
  if workspace.privacy = 'PRIVATE' then raise exception 'This Desk is invite only.'; end if;

  if workspace.privacy = 'PUBLIC' then
    insert into public.desk_members (desk_id, user_id, role)
    values (requested_desk_id, auth.uid(), 'member')
    on conflict (desk_id, user_id) do nothing;
    return 'joined';
  end if;

  insert into public.desk_join_requests (desk_id, user_id, request_type, requested_by, status, updated_at)
  values (requested_desk_id, auth.uid(), 'request', auth.uid(), 'pending', now())
  on conflict (desk_id, user_id, request_type)
  do update set requested_by = auth.uid(), status = 'pending', updated_at = now();
  return 'requested';
end;
$$;

create or replace function public.desk_send_invite(requested_desk_id text, target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  can_invite boolean;
begin
  select (
    public.desk_has_role(requested_desk_id, array['owner', 'moderator'])
    or (
      public.desk_is_member(requested_desk_id)
      and workspace.allow_member_invites
    )
  ) into can_invite
  from public.desk_workspaces workspace
  where workspace.desk_id = requested_desk_id;

  if not coalesce(can_invite, false) then raise exception 'You cannot invite members to this Desk.'; end if;
  if target_user_id = auth.uid() then raise exception 'You are already here.'; end if;
  if public.desk_is_member(requested_desk_id, target_user_id) then raise exception 'That trader is already a member.'; end if;

  insert into public.desk_join_requests (desk_id, user_id, request_type, requested_by, status, updated_at)
  values (requested_desk_id, target_user_id, 'invite', auth.uid(), 'pending', now())
  on conflict (desk_id, user_id, request_type)
  do update set requested_by = auth.uid(), status = 'pending', updated_at = now()
  returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.desk_resolve_request(request_id uuid, resolution text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  request public.desk_join_requests%rowtype;
begin
  if resolution not in ('accepted', 'declined', 'cancelled') then
    raise exception 'Unsupported request decision.';
  end if;
  select * into request from public.desk_join_requests where id = request_id and status = 'pending';
  if request.id is null then raise exception 'That request is no longer pending.'; end if;

  if request.request_type = 'request' then
    if not public.desk_has_role(request.desk_id, array['owner', 'moderator']) and request.user_id <> auth.uid() then
      raise exception 'Only Desk leaders can resolve join requests.';
    end if;
    if request.user_id = auth.uid() and resolution <> 'cancelled' then
      raise exception 'You can only cancel your own request.';
    end if;
  elsif request.user_id <> auth.uid() then
    raise exception 'Only the invited trader can respond to this invitation.';
  end if;

  if resolution = 'accepted' then
    insert into public.desk_members (desk_id, user_id, role)
    values (request.desk_id, request.user_id, 'member')
    on conflict (desk_id, user_id) do nothing;
  end if;

  update public.desk_join_requests
  set status = resolution, updated_at = now()
  where id = request.id;
  return resolution;
end;
$$;

create or replace function public.desk_remove_member(requested_desk_id text, target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  target_role text;
begin
  select role into actor_role from public.desk_members where desk_id = requested_desk_id and user_id = auth.uid();
  select role into target_role from public.desk_members where desk_id = requested_desk_id and user_id = target_user_id;
  if target_role is null then raise exception 'That trader is not in this Desk.'; end if;
  if target_role = 'owner' then raise exception 'The Desk owner cannot leave or be removed.'; end if;

  if target_user_id <> auth.uid() then
    if actor_role not in ('owner', 'moderator') then raise exception 'Only Desk leaders can remove members.'; end if;
    if actor_role = 'moderator' and target_role = 'moderator' then raise exception 'Only the owner can remove a moderator.'; end if;
  end if;

  delete from public.desk_members where desk_id = requested_desk_id and user_id = target_user_id;
  return case when target_user_id = auth.uid() then 'left' else 'removed' end;
end;
$$;

create or replace function public.desk_change_member_role(requested_desk_id text, target_user_id uuid, next_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.desk_has_role(requested_desk_id, array['owner']) then
    raise exception 'Only the Desk owner can change roles.';
  end if;
  if next_role not in ('moderator', 'member') then raise exception 'Unsupported Desk role.'; end if;
  if target_user_id = auth.uid() then raise exception 'The owner role cannot be changed here.'; end if;
  update public.desk_members
  set role = next_role
  where desk_id = requested_desk_id
    and user_id = target_user_id
    and role <> 'owner';
  if not found then raise exception 'That Desk member could not be updated.'; end if;
  return next_role;
end;
$$;

create or replace function public.desk_touch_membership(requested_desk_id text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare touched_at timestamptz := now();
begin
  update public.desk_members
  set last_active_at = touched_at
  where desk_id = requested_desk_id and user_id = auth.uid();
  return touched_at;
end;
$$;

create or replace function public.desk_enforce_inactivity(requested_desk_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer := 0;
  cutoff_days integer;
begin
  if not public.desk_has_role(requested_desk_id, array['owner', 'moderator']) then
    return 0;
  end if;
  select inactivity_days into cutoff_days from public.desk_workspaces where desk_id = requested_desk_id;
  if cutoff_days is null then return 0; end if;
  delete from public.desk_members
  where desk_id = requested_desk_id
    and role <> 'owner'
    and last_active_at < now() - make_interval(days => cutoff_days);
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.desk_request_access(text) from public;
revoke all on function public.desk_send_invite(text, uuid) from public;
revoke all on function public.desk_resolve_request(uuid, text) from public;
revoke all on function public.desk_remove_member(text, uuid) from public;
revoke all on function public.desk_change_member_role(text, uuid, text) from public;
revoke all on function public.desk_touch_membership(text) from public;
revoke all on function public.desk_enforce_inactivity(text) from public;
grant execute on function public.desk_request_access(text) to authenticated;
grant execute on function public.desk_send_invite(text, uuid) to authenticated;
grant execute on function public.desk_resolve_request(uuid, text) to authenticated;
grant execute on function public.desk_remove_member(text, uuid) to authenticated;
grant execute on function public.desk_change_member_role(text, uuid, text) to authenticated;
grant execute on function public.desk_touch_membership(text) to authenticated;
grant execute on function public.desk_enforce_inactivity(text) to authenticated;

insert into public.desk_workspaces (
  desk_id, owner_id, name, description, objective, weekly_mission,
  markets, session, timezone, privacy, capacity
)
select
  desk.id,
  desk.user_id,
  coalesce(nullif(desk.payload ->> 'name', ''), 'Kwant Desk'),
  coalesce(desk.payload ->> 'description', ''),
  coalesce(desk.payload ->> 'objective', ''),
  coalesce(desk.payload ->> 'weeklyMission', ''),
  coalesce(
    array(select jsonb_array_elements_text(coalesce(desk.payload -> 'markets', '[]'::jsonb))),
    array[]::text[]
  ),
  coalesce(nullif(desk.payload ->> 'session', ''), 'New York'),
  coalesce(nullif(desk.payload ->> 'timezone', ''), 'UTC'),
  case
    when desk.payload ->> 'privacy' = 'PRIVATE' then 'PRIVATE'
    when desk.payload ->> 'privacy' = 'PUBLIC' then 'PUBLIC'
    else 'REQUEST'
  end,
  least(50, greatest(2, coalesce((desk.payload ->> 'capacity')::integer, 12)))
from public.social_objects desk
where desk.object_type = 'desk'
on conflict (desk_id) do nothing;

insert into public.desk_members (desk_id, user_id, role, joined_at, last_active_at)
select
  member.desk_id,
  member.user_id,
  case member.payload ->> 'role'
    when 'OWNER' then 'owner'
    when 'STEWARD' then 'moderator'
    else 'member'
  end,
  coalesce(nullif(member.payload ->> 'joinedAt', '')::timestamptz, member.created_at),
  member.updated_at
from public.social_objects member
join public.desk_workspaces workspace on workspace.desk_id = member.desk_id
where member.object_type = 'desk-member'
  and member.desk_id is not null
on conflict (desk_id, user_id) do nothing;

insert into public.desk_members (desk_id, user_id, role, joined_at, last_active_at)
select workspace.desk_id, workspace.owner_id, 'owner', workspace.created_at, workspace.updated_at
from public.desk_workspaces workspace
on conflict (desk_id, user_id) do update set role = 'owner';

insert into public.desk_channels (
  desk_id, name, description, channel_type, position, read_only, created_by
)
select workspace.desk_id, channel.name, channel.description, channel.kind, channel.position, channel.read_only, workspace.owner_id
from public.desk_workspaces workspace
cross join (
  values
    ('general', 'The Desk floor for structured discussion.', 'text', 10, false),
    ('trade-floor', 'Live observations and session coordination.', 'text', 20, false),
    ('desk-rules', 'The shared standard and owner announcements.', 'text', 30, true),
    ('voice-lounge', 'Voice rooms are reserved for a later release.', 'voice', 40, false)
) as channel(name, description, kind, position, read_only)
on conflict (desk_id, name) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.desk_workspaces;
exception when duplicate_object then null;
end
$$;
do $$
begin
  alter publication supabase_realtime add table public.desk_members;
exception when duplicate_object then null;
end
$$;
do $$
begin
  alter publication supabase_realtime add table public.desk_join_requests;
exception when duplicate_object then null;
end
$$;
do $$
begin
  alter publication supabase_realtime add table public.desk_channels;
exception when duplicate_object then null;
end
$$;
do $$
begin
  alter publication supabase_realtime add table public.desk_messages;
exception when duplicate_object then null;
end
$$;
do $$
begin
  alter publication supabase_realtime add table public.desk_message_reactions;
exception when duplicate_object then null;
end
$$;
