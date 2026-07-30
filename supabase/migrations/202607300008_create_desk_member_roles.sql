alter table public.desk_members
  add column if not exists display_role text not null default '',
  add column if not exists badge_color text not null default '',
  add column if not exists badge_icon text not null default 'shield',
  add column if not exists responsibilities text not null default '',
  add column if not exists importance_level smallint not null default 0;

create or replace function public.desk_update_member_role(
  requested_desk_id text,
  target_user_id uuid,
  next_system_role text,
  next_display_role text,
  next_badge_color text,
  next_badge_icon text,
  next_responsibilities text,
  next_importance_level integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_current_role text;
begin
  if not public.desk_has_role(requested_desk_id, array['owner']) then
    raise exception 'Only the Desk owner can manage member roles.';
  end if;

  select role into target_current_role
  from public.desk_members
  where desk_id = requested_desk_id
    and user_id = target_user_id;

  if target_current_role is null then
    raise exception 'That user is not a member of this Desk.';
  end if;

  if target_current_role = 'owner' then
    next_system_role := 'owner';
  elsif next_system_role not in ('moderator', 'member') then
    raise exception 'Choose a valid permission level.';
  end if;

  if length(trim(coalesce(next_display_role, ''))) > 40 then
    raise exception 'Desk role names must be 40 characters or fewer.';
  end if;

  if length(trim(coalesce(next_responsibilities, ''))) > 500 then
    raise exception 'Responsibilities must be 500 characters or fewer.';
  end if;

  if coalesce(next_badge_color, '') <> ''
    and next_badge_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Choose a valid six-digit role colour.';
  end if;

  if next_badge_icon not in ('crown', 'shield', 'star', 'spark', 'chart', 'mentor') then
    raise exception 'Choose a valid role icon.';
  end if;

  update public.desk_members
  set
    role = next_system_role,
    display_role = trim(coalesce(next_display_role, '')),
    badge_color = lower(trim(coalesce(next_badge_color, ''))),
    badge_icon = next_badge_icon,
    responsibilities = trim(coalesce(next_responsibilities, '')),
    importance_level = greatest(0, least(5, coalesce(next_importance_level, 0)))
  where desk_id = requested_desk_id
    and user_id = target_user_id;

  return jsonb_build_object(
    'deskId', requested_desk_id,
    'userId', target_user_id,
    'role', next_system_role,
    'displayRole', trim(coalesce(next_display_role, '')),
    'badgeColor', lower(trim(coalesce(next_badge_color, ''))),
    'badgeIcon', next_badge_icon,
    'responsibilities', trim(coalesce(next_responsibilities, '')),
    'importanceLevel', greatest(0, least(5, coalesce(next_importance_level, 0)))
  );
end;
$$;

revoke all on function public.desk_update_member_role(text, uuid, text, text, text, text, text, integer) from public;
grant execute on function public.desk_update_member_role(text, uuid, text, text, text, text, text, integer) to authenticated;

notify pgrst, 'reload schema';
