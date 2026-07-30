create table if not exists public.social_profile_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  notify_posts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint social_profile_follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists social_profile_follows_following_idx
  on public.social_profile_follows (following_id, created_at desc);

create index if not exists social_profile_follows_follower_idx
  on public.social_profile_follows (follower_id, created_at desc);

alter table public.social_profile_follows enable row level security;

revoke all on table public.social_profile_follows from anon;
grant select, insert, update, delete on table public.social_profile_follows to authenticated;

drop policy if exists "Users read their own follow relationships" on public.social_profile_follows;
create policy "Users read their own follow relationships"
  on public.social_profile_follows
  for select
  to authenticated
  using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "Users follow from their own account" on public.social_profile_follows;
create policy "Users follow from their own account"
  on public.social_profile_follows
  for insert
  to authenticated
  with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists "Users update their own follow preferences" on public.social_profile_follows;
create policy "Users update their own follow preferences"
  on public.social_profile_follows
  for update
  to authenticated
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists "Users unfollow from their own account" on public.social_profile_follows;
create policy "Users unfollow from their own account"
  on public.social_profile_follows
  for delete
  to authenticated
  using (auth.uid() = follower_id);

create or replace function public.social_profile_follow_summary(target_user_id uuid)
returns table (
  follower_count bigint,
  following_count bigint,
  viewer_follows boolean,
  follows_viewer boolean,
  notifications_enabled boolean,
  can_view_followers boolean,
  can_view_following boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with target_profile as (
    select profile.payload
    from public.social_objects profile
    where profile.user_id = target_user_id
      and profile.object_type = 'profile'
    order by profile.updated_at desc
    limit 1
  )
  select
    (
      select count(*)
      from public.social_profile_follows relation
      where relation.following_id = target_user_id
    ) as follower_count,
    (
      select count(*)
      from public.social_profile_follows relation
      where relation.follower_id = target_user_id
    ) as following_count,
    exists (
      select 1
      from public.social_profile_follows relation
      where relation.follower_id = auth.uid()
        and relation.following_id = target_user_id
    ) as viewer_follows,
    exists (
      select 1
      from public.social_profile_follows relation
      where relation.follower_id = target_user_id
        and relation.following_id = auth.uid()
    ) as follows_viewer,
    coalesce((
      select relation.notify_posts
      from public.social_profile_follows relation
      where relation.follower_id = auth.uid()
        and relation.following_id = target_user_id
    ), false) as notifications_enabled,
    (
      auth.uid() = target_user_id
      or coalesce((
        select profile.payload #>> '{visibility,followers}'
        from target_profile profile
      ), 'community') <> 'private'
    ) as can_view_followers,
    (
      auth.uid() = target_user_id
      or coalesce((
        select profile.payload #>> '{visibility,following}'
        from target_profile profile
      ), 'community') <> 'private'
    ) as can_view_following;
$$;

create or replace function public.social_profile_follow_list(
  target_user_id uuid,
  list_kind text,
  result_limit integer default 50,
  result_offset integer default 0
)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  avatar_url text,
  bio text,
  viewer_follows boolean,
  follows_viewer boolean,
  notifications_enabled boolean,
  followed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  list_allowed boolean := false;
  safe_limit integer := greatest(1, least(coalesce(result_limit, 50), 100));
  safe_offset integer := greatest(0, coalesce(result_offset, 0));
begin
  if list_kind not in ('followers', 'following') then
    raise exception 'Unsupported follow list.';
  end if;

  if viewer_id = target_user_id then
    list_allowed := true;
  else
    select
      coalesce(
        profile.payload #>> (
          case
            when list_kind = 'followers' then array['visibility', 'followers']::text[]
            else array['visibility', 'following']::text[]
          end
        ),
        'community'
      ) <> 'private'
      into list_allowed
    from public.social_objects profile
    where profile.user_id = target_user_id
      and profile.object_type = 'profile'
    order by profile.updated_at desc
    limit 1;
  end if;

  if not coalesce(list_allowed, true) then
    return;
  end if;

  if list_kind = 'followers' then
    return query
      select
        relation.follower_id,
        coalesce(nullif(profile.payload ->> 'displayName', ''), nullif(profile.author_label, ''), 'Kwant User'),
        coalesce(profile.payload ->> 'handle', ''),
        coalesce(profile.payload ->> 'avatarUrl', ''),
        left(coalesce(profile.payload ->> 'bio', ''), 240),
        exists (
          select 1
          from public.social_profile_follows viewer_relation
          where viewer_relation.follower_id = viewer_id
            and viewer_relation.following_id = relation.follower_id
        ),
        exists (
          select 1
          from public.social_profile_follows reverse_relation
          where reverse_relation.follower_id = relation.follower_id
            and reverse_relation.following_id = viewer_id
        ),
        coalesce((
          select viewer_relation.notify_posts
          from public.social_profile_follows viewer_relation
          where viewer_relation.follower_id = viewer_id
            and viewer_relation.following_id = relation.follower_id
        ), false),
        relation.created_at
      from public.social_profile_follows relation
      left join lateral (
        select social_profile.author_label, social_profile.payload
        from public.social_objects social_profile
        where social_profile.user_id = relation.follower_id
          and social_profile.object_type = 'profile'
        order by social_profile.updated_at desc
        limit 1
      ) profile on true
      where relation.following_id = target_user_id
      order by relation.created_at desc
      limit safe_limit
      offset safe_offset;
  else
    return query
      select
        relation.following_id,
        coalesce(nullif(profile.payload ->> 'displayName', ''), nullif(profile.author_label, ''), 'Kwant User'),
        coalesce(profile.payload ->> 'handle', ''),
        coalesce(profile.payload ->> 'avatarUrl', ''),
        left(coalesce(profile.payload ->> 'bio', ''), 240),
        exists (
          select 1
          from public.social_profile_follows viewer_relation
          where viewer_relation.follower_id = viewer_id
            and viewer_relation.following_id = relation.following_id
        ),
        exists (
          select 1
          from public.social_profile_follows reverse_relation
          where reverse_relation.follower_id = relation.following_id
            and reverse_relation.following_id = viewer_id
        ),
        coalesce((
          select viewer_relation.notify_posts
          from public.social_profile_follows viewer_relation
          where viewer_relation.follower_id = viewer_id
            and viewer_relation.following_id = relation.following_id
        ), false),
        relation.created_at
      from public.social_profile_follows relation
      left join lateral (
        select social_profile.author_label, social_profile.payload
        from public.social_objects social_profile
        where social_profile.user_id = relation.following_id
          and social_profile.object_type = 'profile'
        order by social_profile.updated_at desc
        limit 1
      ) profile on true
      where relation.follower_id = target_user_id
      order by relation.created_at desc
      limit safe_limit
      offset safe_offset;
  end if;
end;
$$;

revoke all on function public.social_profile_follow_summary(uuid) from public;
revoke all on function public.social_profile_follow_list(uuid, text, integer, integer) from public;
grant execute on function public.social_profile_follow_summary(uuid) to authenticated;
grant execute on function public.social_profile_follow_list(uuid, text, integer, integer) to authenticated;

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  source_user_id uuid not null references auth.users(id) on delete cascade,
  source_object_id text not null,
  kind text not null default 'followed_account_update',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_user_id, source_user_id, source_object_id, kind)
);

create index if not exists social_notifications_recipient_idx
  on public.social_notifications (recipient_user_id, read_at, created_at desc);

alter table public.social_notifications enable row level security;

revoke all on table public.social_notifications from anon;
grant select, update, delete on table public.social_notifications to authenticated;

drop policy if exists "Users read their own social notifications" on public.social_notifications;
create policy "Users read their own social notifications"
  on public.social_notifications
  for select
  to authenticated
  using (auth.uid() = recipient_user_id);

drop policy if exists "Users update their own social notifications" on public.social_notifications;
create policy "Users update their own social notifications"
  on public.social_notifications
  for update
  to authenticated
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

drop policy if exists "Users delete their own social notifications" on public.social_notifications;
create policy "Users delete their own social notifications"
  on public.social_notifications
  for delete
  to authenticated
  using (auth.uid() = recipient_user_id);

create or replace function public.create_new_follower_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_label text;
begin
  select coalesce(
    nullif(profile.payload ->> 'displayName', ''),
    nullif(profile.author_label, ''),
    'A Kwant Desk user'
  )
  into follower_label
  from public.social_objects profile
  where profile.user_id = new.follower_id
    and profile.object_type = 'profile'
  order by profile.updated_at desc
  limit 1;

  insert into public.social_notifications (
    recipient_user_id,
    source_user_id,
    source_object_id,
    kind,
    payload,
    created_at
  )
  values (
    new.following_id,
    new.follower_id,
    'follow:' || new.follower_id::text,
    'new_follower',
    jsonb_build_object('authorLabel', coalesce(follower_label, 'A Kwant Desk user')),
    now()
  )
  on conflict (recipient_user_id, source_user_id, source_object_id, kind)
  do update set
    payload = excluded.payload,
    read_at = null,
    created_at = excluded.created_at;

  return new;
end;
$$;

drop trigger if exists create_new_follower_notification_trigger on public.social_profile_follows;
create trigger create_new_follower_notification_trigger
after insert on public.social_profile_follows
for each row execute function public.create_new_follower_notification();

create or replace function public.create_followed_account_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.object_type not in ('post', 'precord', 'receipt') then
    return new;
  end if;

  insert into public.social_notifications (
    recipient_user_id,
    source_user_id,
    source_object_id,
    kind,
    payload,
    created_at
  )
  select
    relation.follower_id,
    new.user_id,
    new.id,
    'followed_account_update',
    jsonb_build_object(
      'authorLabel', new.author_label,
      'objectType', new.object_type,
      'parentId', new.parent_id,
      'createdAt', new.created_at
    ),
    now()
  from public.social_profile_follows relation
  where relation.following_id = new.user_id
    and relation.notify_posts = true
    and relation.follower_id <> new.user_id
  on conflict (recipient_user_id, source_user_id, source_object_id, kind) do nothing;

  return new;
end;
$$;

drop trigger if exists create_followed_account_notifications_trigger on public.social_objects;
create trigger create_followed_account_notifications_trigger
after insert on public.social_objects
for each row execute function public.create_followed_account_notifications();

do $$
begin
  alter publication supabase_realtime add table public.social_profile_follows;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.social_notifications;
exception
  when duplicate_object then null;
end
$$;
