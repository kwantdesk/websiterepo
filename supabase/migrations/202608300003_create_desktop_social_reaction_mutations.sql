alter table public.desktop_socials_mutation_receipts
  drop constraint if exists desktop_socials_mutation_receipts_operation_check;
alter table public.desktop_socials_mutation_receipts
  add constraint desktop_socials_mutation_receipts_operation_check
  check (operation in ('follow', 'unfollow', 'notifications', 'reaction'));

create or replace function public.desktop_socials_reaction_summary(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_target_object_id text,
  p_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.social_objects%rowtype;
  viewer_row public.social_objects%rowtype;
  viewer_found boolean := false;
  target_visible boolean := false;
  total_count bigint := 0;
  poll_options jsonb := '[]'::jsonb;
  option_counts jsonb := '[]'::jsonb;
  poll_index integer;
  poll_option_count bigint;
  viewer_option_index integer := null;
  loaded_at timestamptz := clock_timestamp();
  viewer_reaction jsonb := null;
begin
  if p_actor_id is null or p_target_user_id is null then
    raise exception using errcode = '22023', message = 'socials_invalid_reaction_target';
  end if;
  if p_target_object_id is null
      or p_target_object_id !~ '^[a-zA-Z0-9:_-]{1,180}$' then
    raise exception using errcode = '22023', message = 'socials_invalid_reaction_target';
  end if;
  if p_kind not in ('LIKE', 'USEFUL', 'CLEAR', 'EVIDENCE', 'SAVED', 'FIRE', 'TARGET', 'BRAIN', 'APPLAUSE', 'POLL') then
    raise exception using errcode = '22023', message = 'socials_invalid_reaction_kind';
  end if;

  select target.*
    into target_row
  from public.social_objects target
  where target.user_id = p_target_user_id
    and target.id = p_target_object_id
    and target.object_type in ('post', 'precord')
  limit 1;
  if not found then
    raise exception using errcode = 'P0002', message = 'socials_reaction_target_missing';
  end if;

  target_visible := target_row.user_id = p_actor_id
    or target_row.scope = 'community'
    or (
      target_row.scope = 'friends'
      and exists (
        select 1
        from public.social_objects outgoing
        join public.social_objects incoming
          on incoming.object_type = 'follow'
          and incoming.user_id = target_row.user_id
          and incoming.payload ->> 'targetUserId' = p_actor_id::text
        where outgoing.object_type = 'follow'
          and outgoing.user_id = p_actor_id
          and outgoing.payload ->> 'targetUserId' = target_row.user_id::text
      )
    )
    or (
      target_row.scope = 'desk'
      and target_row.desk_id is not null
      and exists (
        select 1
        from public.desk_members member
        where member.desk_id = target_row.desk_id
          and member.user_id = p_actor_id
      )
    );
  if not target_visible then
    raise exception using errcode = '42501', message = 'socials_reaction_target_forbidden';
  end if;

  if (target_row.object_type = 'post' and p_kind not in ('LIKE', 'SAVED', 'POLL'))
      or (target_row.object_type = 'precord' and p_kind not in ('USEFUL', 'CLEAR', 'EVIDENCE', 'SAVED', 'FIRE', 'TARGET', 'BRAIN', 'APPLAUSE')) then
    raise exception using errcode = '22023', message = 'socials_reaction_kind_not_allowed';
  end if;

  if p_kind = 'POLL' then
    poll_options := coalesce(target_row.payload #> '{poll,options}', '[]'::jsonb);
    if jsonb_typeof(poll_options) <> 'array'
        or jsonb_array_length(poll_options) < 2
        or jsonb_array_length(poll_options) > 6 then
      raise exception using errcode = '22023', message = 'socials_reaction_kind_not_allowed';
    end if;
  end if;

  select count(*)
    into total_count
  from public.social_objects reaction
  where reaction.object_type = 'reaction'
    and reaction.parent_id = p_target_object_id
    and reaction.payload ->> 'kind' = p_kind
    and (
      not (reaction.payload ? 'targetUserId')
      or reaction.payload ->> 'targetUserId' = p_target_user_id::text
    )
    and (
      reaction.user_id = p_actor_id
      or reaction.scope = 'community'
      or (
        reaction.scope = 'friends'
        and exists (
          select 1
          from public.social_objects outgoing
          join public.social_objects incoming
            on incoming.object_type = 'follow'
            and incoming.user_id = reaction.user_id
            and incoming.payload ->> 'targetUserId' = p_actor_id::text
          where outgoing.object_type = 'follow'
            and outgoing.user_id = p_actor_id
            and outgoing.payload ->> 'targetUserId' = reaction.user_id::text
        )
      )
      or (
        reaction.scope = 'desk'
        and reaction.desk_id is not null
        and exists (
          select 1 from public.desk_members member
          where member.desk_id = reaction.desk_id and member.user_id = p_actor_id
        )
      )
    );

  select reaction.*
    into viewer_row
  from public.social_objects reaction
  where reaction.user_id = p_actor_id
    and reaction.id = 'reaction:' || p_target_object_id || ':' || p_kind
    and reaction.object_type = 'reaction'
    and reaction.parent_id = p_target_object_id
    and reaction.payload ->> 'kind' = p_kind
    and (
      not (reaction.payload ? 'targetUserId')
      or reaction.payload ->> 'targetUserId' = p_target_user_id::text
    )
  limit 1;
  viewer_found := found;

  if viewer_found and p_kind = 'POLL' then
    if jsonb_typeof(viewer_row.payload -> 'optionIndex') = 'number'
        and viewer_row.payload ->> 'optionIndex' ~ '^[0-5]$'
        and (viewer_row.payload ->> 'optionIndex')::integer < jsonb_array_length(poll_options) then
      viewer_option_index := (viewer_row.payload ->> 'optionIndex')::integer;
    else
      -- Legacy or externally corrupted rows must not poison a bounded native
      -- authority response. They are excluded until rewritten by a valid vote.
      viewer_found := false;
    end if;
  end if;
  if viewer_found then
    viewer_reaction := jsonb_build_object(
      'userId', viewer_row.user_id::text,
      'id', viewer_row.id,
      'authorLabel', viewer_row.author_label,
      'objectType', viewer_row.object_type,
      'scope', viewer_row.scope,
      'deskId', viewer_row.desk_id,
      'parentId', viewer_row.parent_id,
      'payload', viewer_row.payload || jsonb_build_object('targetUserId', p_target_user_id::text),
      'createdAt', pg_catalog.to_char(viewer_row.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'updatedAt', pg_catalog.to_char(viewer_row.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'cloudSaved', true
    );
  end if;

  if p_kind = 'POLL' then
    total_count := 0;
    for poll_index in 0..jsonb_array_length(poll_options) - 1 loop
      select count(*)
        into poll_option_count
        from public.social_objects reaction
        where reaction.object_type = 'reaction'
          and reaction.parent_id = p_target_object_id
          and reaction.payload ->> 'kind' = 'POLL'
          and case
            when jsonb_typeof(reaction.payload -> 'optionIndex') = 'number'
                and reaction.payload ->> 'optionIndex' ~ '^[0-5]$'
              then (reaction.payload ->> 'optionIndex')::integer = poll_index
            else false
          end
          and (
            not (reaction.payload ? 'targetUserId')
            or reaction.payload ->> 'targetUserId' = p_target_user_id::text
          )
          and (
            reaction.user_id = p_actor_id
            or reaction.scope = 'community'
            or (
              reaction.scope = 'friends'
              and exists (
                select 1
                from public.social_objects outgoing
                join public.social_objects incoming
                  on incoming.object_type = 'follow'
                  and incoming.user_id = reaction.user_id
                  and incoming.payload ->> 'targetUserId' = p_actor_id::text
                where outgoing.object_type = 'follow'
                  and outgoing.user_id = p_actor_id
                  and outgoing.payload ->> 'targetUserId' = reaction.user_id::text
              )
            )
            or (
              reaction.scope = 'desk'
              and reaction.desk_id is not null
              and exists (
                select 1 from public.desk_members member
                where member.desk_id = reaction.desk_id and member.user_id = p_actor_id
              )
            )
          );
      option_counts := option_counts || jsonb_build_array(poll_option_count);
      total_count := total_count + poll_option_count;
    end loop;
  end if;

  return jsonb_build_object(
    'version', 1,
    'targetUserId', p_target_user_id::text,
    'targetObjectId', p_target_object_id,
    'targetObjectType', target_row.object_type,
    'kind', p_kind,
    'viewerActive', viewer_found,
    'viewerOptionIndex', viewer_option_index,
    'totalCount', total_count,
    'optionCounts', option_counts,
    'viewerReaction', viewer_reaction,
    'loadedAt', pg_catalog.to_char(loaded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
end;
$$;

create or replace function public.desktop_socials_apply_reaction_mutation(
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_target_user_id uuid,
  p_target_object_id text,
  p_kind text,
  p_enabled boolean,
  p_option_index integer,
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
  target_row public.social_objects%rowtype;
  actor_profile public.social_objects%rowtype;
  reaction_scope text;
  reaction_desk_id text;
  reaction_id text;
  reaction_payload jsonb;
  poll_options jsonb := '[]'::jsonb;
  poll_closes_at timestamptz := null;
  author_label text := 'Kwant Trader';
  summary jsonb;
  receipt jsonb;
begin
  if p_idempotency_key is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'socials_invalid_idempotency_key';
  end if;
  if p_enabled is null then
    raise exception using errcode = '22023', message = 'socials_invalid_reaction_request';
  end if;
  if (p_kind = 'POLL') <> (p_option_index is not null) then
    raise exception using errcode = '22023', message = 'socials_invalid_poll_option';
  end if;
  if p_option_index is not null and (p_option_index < 0 or p_option_index > 5) then
    raise exception using errcode = '22023', message = 'socials_invalid_poll_option';
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

  -- This call validates the target, item-specific reaction kind and the
  -- actor's private/community/friends/Desk read authority before any write.
  summary := public.desktop_socials_reaction_summary(
    p_actor_id, p_target_user_id, p_target_object_id, p_kind
  );
  applied_at := clock_timestamp();

  select target.*
    into strict target_row
  from public.social_objects target
  where target.user_id = p_target_user_id
    and target.id = p_target_object_id
    and target.object_type in ('post', 'precord')
  limit 1;

  select profile.*
    into actor_profile
  from public.social_objects profile
  where profile.user_id = p_actor_id
    and profile.object_type = 'profile'
  order by profile.updated_at desc
  limit 1;
  if found then
    author_label := coalesce(
      nullif(actor_profile.payload ->> 'displayName', ''),
      nullif(actor_profile.author_label, ''),
      author_label
    );
  end if;

  if p_kind = 'POLL' then
    poll_options := coalesce(target_row.payload #> '{poll,options}', '[]'::jsonb);
    if p_option_index >= jsonb_array_length(poll_options) then
      raise exception using errcode = '22023', message = 'socials_invalid_poll_option';
    end if;
    if nullif(target_row.payload #>> '{poll,closesAt}', '') is not null then
      poll_closes_at := (target_row.payload #>> '{poll,closesAt}')::timestamptz;
    end if;
    if poll_closes_at is not null and poll_closes_at <= applied_at then
      raise exception using errcode = '22023', message = 'socials_poll_closed';
    end if;
  end if;

  if p_kind = 'SAVED' then
    reaction_scope := case
      when target_row.object_type = 'precord' then 'private'
      when coalesce(actor_profile.payload #>> '{visibility,saves}', 'private') = 'community' then 'community'
      else 'private'
    end;
    reaction_desk_id := null;
  else
    reaction_scope := target_row.scope;
    reaction_desk_id := target_row.desk_id;
  end if;
  reaction_id := 'reaction:' || p_target_object_id || ':' || p_kind;
  reaction_payload := jsonb_build_object(
    'kind', p_kind,
    'targetUserId', p_target_user_id::text
  ) || case
    when p_kind = 'POLL' then jsonb_build_object('optionIndex', p_option_index)
    else '{}'::jsonb
  end;

  if p_enabled then
    insert into public.social_objects (
      user_id, id, author_label, object_type, scope, desk_id, parent_id,
      payload, created_at, updated_at
    ) values (
      p_actor_id, reaction_id, author_label, 'reaction', reaction_scope,
      reaction_desk_id, p_target_object_id, reaction_payload, applied_at, applied_at
    )
    on conflict (user_id, id) do update set
      author_label = excluded.author_label,
      object_type = excluded.object_type,
      scope = excluded.scope,
      desk_id = excluded.desk_id,
      parent_id = excluded.parent_id,
      payload = excluded.payload,
      updated_at = excluded.updated_at;
  else
    delete from public.social_objects reaction
    where reaction.user_id = p_actor_id
      and reaction.id = reaction_id
      and reaction.object_type = 'reaction';
  end if;

  summary := public.desktop_socials_reaction_summary(
    p_actor_id, p_target_user_id, p_target_object_id, p_kind
  );
  receipt := jsonb_build_object(
    'version', 1,
    'idempotencyKey', p_idempotency_key::text,
    'targetUserId', p_target_user_id::text,
    'targetObjectId', p_target_object_id,
    'kind', p_kind,
    'enabled', p_enabled,
    'optionIndex', p_option_index,
    'appliedAt', pg_catalog.to_char(applied_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'idempotent', false,
    'summary', summary
  );

  insert into public.desktop_socials_mutation_receipts (
    actor_id, idempotency_key, operation, target_user_id, request_hash, receipt, created_at
  ) values (
    p_actor_id, p_idempotency_key, 'reaction', p_target_user_id, p_request_hash, receipt, applied_at
  );

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

revoke all on function public.desktop_socials_reaction_summary(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.desktop_socials_apply_reaction_mutation(uuid, uuid, uuid, text, text, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function public.desktop_socials_reaction_summary(uuid, uuid, text, text)
  to service_role;
grant execute on function public.desktop_socials_apply_reaction_mutation(uuid, uuid, uuid, text, text, boolean, integer, text)
  to service_role;

comment on function public.desktop_socials_reaction_summary(uuid, uuid, text, text) is
  'Fixed service-role-only SOCIALS reaction read with explicit actor, target ownership and effective privacy checks.';
comment on function public.desktop_socials_apply_reaction_mutation(uuid, uuid, uuid, text, text, boolean, integer, text) is
  'Serialized, request-hash-idempotent native SOCIALS reaction mutation; receipts share the bounded per-actor retention table.';
