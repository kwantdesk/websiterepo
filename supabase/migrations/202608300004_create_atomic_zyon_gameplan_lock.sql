create or replace function public.lock_zyon_gameplan_v1(
  p_user_id uuid,
  p_draft_id text,
  p_expected_updated_at timestamptz,
  p_record_id text,
  p_author_label text,
  p_payload jsonb,
  p_locked_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_draft public.zyon_gameplan_drafts%rowtype;
  locked_record public.social_objects%rowtype;
begin
  select *
    into locked_draft
  from public.zyon_gameplan_drafts
  where user_id = p_user_id
    and id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'GAMEPLAN_NOT_FOUND';
  end if;

  select *
    into locked_record
  from public.social_objects
  where user_id = p_user_id
    and object_type = 'precord'
    and (id = p_record_id or payload ->> 'sourceGameplanId' = p_draft_id)
  order by created_at asc
  limit 1;

  if found then
    return jsonb_build_object('record', to_jsonb(locked_record), 'idempotent', true);
  end if;

  if locked_draft.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'GAMEPLAN_VERSION_CONFLICT';
  end if;

  if jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload ->> 'source' is distinct from 'ZYON'
    or p_payload ->> 'sourceGameplanId' is distinct from p_draft_id
    or p_payload ->> 'status' is distinct from 'LOCKED'
    or p_payload ->> 'lockedAt' is distinct from to_char(p_locked_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    or octet_length(p_payload::text) > 120000 then
    raise exception using errcode = '22023', message = 'GAMEPLAN_LOCK_PAYLOAD_INVALID';
  end if;

  insert into public.social_objects (
    user_id,
    id,
    author_label,
    object_type,
    scope,
    desk_id,
    parent_id,
    payload,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_record_id,
    left(coalesce(nullif(trim(p_author_label), ''), 'Kwant Trader'), 48),
    'precord',
    'community',
    null,
    null,
    p_payload,
    p_locked_at,
    p_locked_at
  )
  returning * into locked_record;

  return jsonb_build_object('record', to_jsonb(locked_record), 'idempotent', false);
end;
$$;

revoke all on function public.lock_zyon_gameplan_v1(uuid,text,timestamptz,text,text,jsonb,timestamptz) from public;
revoke all on function public.lock_zyon_gameplan_v1(uuid,text,timestamptz,text,text,jsonb,timestamptz) from anon;
revoke all on function public.lock_zyon_gameplan_v1(uuid,text,timestamptz,text,text,jsonb,timestamptz) from authenticated;
grant execute on function public.lock_zyon_gameplan_v1(uuid,text,timestamptz,text,text,jsonb,timestamptz) to service_role;
