create unique index if not exists desk_workspaces_name_unique_idx
  on public.desk_workspaces ((lower(btrim(name))));

create or replace function public.desk_name_available(
  requested_name text,
  excluded_desk_id text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    char_length(btrim(coalesce(requested_name, ''))) between 3 and 60
    and not exists (
      select 1
      from public.desk_workspaces workspace
      where lower(btrim(workspace.name)) = lower(btrim(requested_name))
        and (excluded_desk_id is null or workspace.desk_id <> excluded_desk_id)
    );
$$;

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
  channel_rows jsonb;
begin
  if viewer_id is null then
    raise exception 'Authentication required.';
  end if;
  if char_length(clean_name) < 3 or char_length(clean_name) > 60 then
    raise exception 'A Desk name must contain 3 to 60 characters.';
  end if;
  if not public.desk_name_available(clean_name, null) then
    raise exception 'This Desk already exists.' using errcode = '23505';
  end if;
  if clean_privacy not in ('PUBLIC', 'REQUEST', 'PRIVATE') then
    clean_privacy := 'REQUEST';
  end if;

  insert into public.desk_workspaces (
    desk_id,
    owner_id,
    name,
    description,
    objective,
    weekly_mission,
    markets,
    session,
    timezone,
    privacy,
    capacity
  )
  values (
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
  )
  returning * into workspace_row;

  insert into public.desk_members (desk_id, user_id, role)
  values (created_desk_id, viewer_id, 'owner')
  returning * into member_row;

  insert into public.desk_channels (
    desk_id,
    name,
    description,
    channel_type,
    position,
    read_only,
    created_by
  )
  values
    (created_desk_id, 'general', 'The Desk floor for structured discussion.', 'text', 10, false, viewer_id),
    (created_desk_id, 'trade-floor', 'Live observations and session coordination.', 'text', 20, false, viewer_id),
    (created_desk_id, 'desk-rules', 'The shared standard and owner announcements.', 'text', 30, true, viewer_id),
    (created_desk_id, 'voice-lounge', 'Voice rooms are reserved for a later release.', 'voice', 40, false, viewer_id);

  select coalesce(
    jsonb_agg(to_jsonb(channel_row) order by channel_row.position),
    '[]'::jsonb
  )
  into channel_rows
  from public.desk_channels channel_row
  where channel_row.desk_id = created_desk_id;

  return jsonb_build_object(
    'workspace', to_jsonb(workspace_row),
    'member', to_jsonb(member_row),
    'channels', channel_rows
  );
end;
$$;

revoke all on function public.desk_name_available(text, text) from public;
revoke all on function public.desk_create_workspace(text, text, text, text, text[], text, text, text, integer) from public;
grant execute on function public.desk_name_available(text, text) to authenticated;
grant execute on function public.desk_create_workspace(text, text, text, text, text[], text, text, text, integer) to authenticated;
