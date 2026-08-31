create table if not exists public.desktop_socials_mutation_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  operation text not null check (operation in ('follow', 'unfollow', 'notifications')),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  receipt jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_id, idempotency_key)
);

create index if not exists desktop_socials_mutation_receipts_created_idx
  on public.desktop_socials_mutation_receipts (created_at);
create index if not exists desktop_socials_mutation_receipts_actor_created_idx
  on public.desktop_socials_mutation_receipts (actor_id, created_at desc, idempotency_key desc);

alter table public.desktop_socials_mutation_receipts enable row level security;
revoke all on table public.desktop_socials_mutation_receipts from public, anon, authenticated;

create or replace function public.desktop_socials_apply_follow_mutation(
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_action text,
  p_target_user_id uuid,
  p_notifications_enabled boolean,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_hash text;
  existing_receipt jsonb;
  applied_at timestamptz;
  affected integer := 0;
  target_visibility jsonb := '{}'::jsonb;
  summary jsonb;
  receipt jsonb;
begin
  if p_actor_id is null or p_target_user_id is null or p_actor_id = p_target_user_id then
    raise exception using errcode = '22023', message = 'socials_invalid_follow_target';
  end if;
  if p_idempotency_key is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'socials_invalid_idempotency_key';
  end if;
  if p_action not in ('follow', 'unfollow', 'notifications') then
    raise exception using errcode = '22023', message = 'socials_invalid_follow_action';
  end if;
  if (p_action = 'notifications') <> (p_notifications_enabled is not null) then
    raise exception using errcode = '22023', message = 'socials_invalid_notification_preference';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('socials-actor:' || p_actor_id::text, 0)
  );
  select stored.request_hash, stored.receipt
    into existing_hash, existing_receipt
  from public.desktop_socials_mutation_receipts stored
  where stored.actor_id = p_actor_id
    and stored.idempotency_key = p_idempotency_key;
  if existing_receipt is not null then
    if existing_hash <> p_request_hash then
      raise exception using errcode = '22023', message = 'socials_idempotency_conflict';
    end if;
    return existing_receipt || jsonb_build_object('idempotent', true);
  end if;

  -- Capture application time after this actor's serialized wait, not when the
  -- queued statement first arrived.
  applied_at := clock_timestamp();

  select coalesce(profile.payload -> 'visibility', '{}'::jsonb)
    into target_visibility
  from public.social_objects profile
  where profile.user_id = p_target_user_id
    and profile.object_type = 'profile'
  order by profile.updated_at desc
  limit 1;
  if not found then
    raise exception using errcode = 'P0002', message = 'socials_follow_target_missing';
  end if;

  if p_action = 'follow' then
    insert into public.social_profile_follows (
      follower_id, following_id, notify_posts, created_at, updated_at
    ) values (
      p_actor_id, p_target_user_id, false, applied_at, applied_at
    )
    on conflict (follower_id, following_id) do update
      set updated_at = excluded.updated_at;
  elsif p_action = 'unfollow' then
    delete from public.social_profile_follows relation
    where relation.follower_id = p_actor_id
      and relation.following_id = p_target_user_id;
  else
    update public.social_profile_follows relation
      set notify_posts = p_notifications_enabled,
          updated_at = applied_at
    where relation.follower_id = p_actor_id
      and relation.following_id = p_target_user_id;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception using errcode = '22023', message = 'socials_follow_required';
    end if;
  end if;

  summary := jsonb_build_object(
    'version', 1,
    'profileUserId', p_target_user_id::text,
    'followerCount', (
      select count(*) from public.social_profile_follows relation
      where relation.following_id = p_target_user_id
    ),
    'followingCount', (
      select count(*) from public.social_profile_follows relation
      where relation.follower_id = p_target_user_id
    ),
    'viewerFollows', exists (
      select 1 from public.social_profile_follows relation
      where relation.follower_id = p_actor_id and relation.following_id = p_target_user_id
    ),
    'followsViewer', exists (
      select 1 from public.social_profile_follows relation
      where relation.follower_id = p_target_user_id and relation.following_id = p_actor_id
    ),
    'notificationsEnabled', coalesce((
      select relation.notify_posts from public.social_profile_follows relation
      where relation.follower_id = p_actor_id and relation.following_id = p_target_user_id
    ), false),
    'canViewFollowers', coalesce(target_visibility ->> 'followers', 'community') <> 'private',
    'canViewFollowing', coalesce(target_visibility ->> 'following', 'community') <> 'private',
    'loadedAt', pg_catalog.to_char(applied_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
  receipt := jsonb_build_object(
    'version', 1,
    'idempotencyKey', p_idempotency_key::text,
    'action', p_action,
    'targetUserId', p_target_user_id::text,
    'appliedAt', pg_catalog.to_char(applied_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'idempotent', false,
    'summary', summary
  );

  insert into public.desktop_socials_mutation_receipts (
    actor_id, idempotency_key, operation, target_user_id, request_hash, receipt, created_at
  ) values (
    p_actor_id, p_idempotency_key, p_action, p_target_user_id, p_request_hash, receipt, applied_at
  );

  -- Retain replay protection for a long retry window while bounding durable
  -- state per account. The just-written receipt is always among the newest.
  delete from public.desktop_socials_mutation_receipts stored
  where stored.actor_id = p_actor_id
    and stored.created_at < applied_at - interval '90 days';
  delete from public.desktop_socials_mutation_receipts stored
  where stored.actor_id = p_actor_id
    and stored.idempotency_key in (
      select overflow.idempotency_key
      from public.desktop_socials_mutation_receipts overflow
      where overflow.actor_id = p_actor_id
      order by overflow.created_at desc, overflow.idempotency_key desc
      offset 5000
    );
  return receipt;
end;
$$;

revoke all on function public.desktop_socials_apply_follow_mutation(uuid, uuid, text, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.desktop_socials_apply_follow_mutation(uuid, uuid, text, uuid, boolean, text)
  to service_role;

comment on table public.desktop_socials_mutation_receipts is
  'Server-only durable idempotency receipts for fixed native SOCIALS mutations; retained for 90 days and capped at 5,000 receipts per actor.';

alter table public.desktop_access_entitlements
  drop constraint if exists desktop_access_entitlements_scopes_allowed;
alter table public.desktop_access_entitlements
  add constraint desktop_access_entitlements_scopes_allowed check (
    scopes <@ array[
      'market.trades:read', 'market.depth:read', 'market.replay:read',
      'market.indices:read', 'lab.snapshot:read', 'options.analytics:read',
      'assistant.zyon:read', 'assistant.zyon:write',
      'news.intelligence:read', 'news.intelligence:write',
      'socials.account:read', 'socials.account:write'
    ]::text[]
    and not ('*' = any(scopes))
    and (not enabled or cardinality(scopes) > 0)
  );

alter table public.desktop_authorization_codes
  drop constraint if exists desktop_authorization_codes_scopes_allowed;
alter table public.desktop_authorization_codes
  add constraint desktop_authorization_codes_scopes_allowed check (
    scopes <@ array[
      'market.trades:read', 'market.depth:read', 'market.replay:read',
      'market.indices:read', 'lab.snapshot:read', 'options.analytics:read',
      'assistant.zyon:read', 'assistant.zyon:write',
      'news.intelligence:read', 'news.intelligence:write',
      'socials.account:read', 'socials.account:write'
    ]::text[]
    and cardinality(scopes) > 0
    and not ('*' = any(scopes))
  );

comment on constraint desktop_access_entitlements_scopes_allowed
  on public.desktop_access_entitlements is
  'Explicit native workstation grants. This migration widens the allowlist but never grants a new scope to an account.';
