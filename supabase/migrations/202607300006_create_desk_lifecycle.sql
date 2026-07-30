alter table public.desk_workspaces
  add column if not exists archived_at timestamptz;

create index if not exists desk_workspaces_owner_archive_idx
  on public.desk_workspaces (owner_id, archived_at, updated_at desc);

create or replace function public.handle_desk_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    update public.desk_join_requests
    set status = 'cancelled', updated_at = now()
    where desk_id = new.desk_id and status = 'pending';

    delete from public.desk_focus_locks
    where desk_id = new.desk_id;
  end if;
  return new;
end;
$$;

drop trigger if exists handle_desk_archive_trigger on public.desk_workspaces;
create trigger handle_desk_archive_trigger
after update of archived_at on public.desk_workspaces
for each row execute function public.handle_desk_archive();

create or replace function public.desk_is_member(
  requested_desk_id text,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.desk_members member
    join public.desk_workspaces workspace
      on workspace.desk_id = member.desk_id
    where member.desk_id = requested_desk_id
      and member.user_id = requested_user_id
      and (
        workspace.archived_at is null
        or workspace.owner_id = requested_user_id
      )
  );
$$;

create or replace function public.desk_has_role(
  requested_desk_id text,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.desk_members member
    join public.desk_workspaces workspace
      on workspace.desk_id = member.desk_id
    where member.desk_id = requested_desk_id
      and member.user_id = auth.uid()
      and member.role = any(allowed_roles)
      and workspace.archived_at is null
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
    join public.desk_workspaces workspace on workspace.desk_id = channel.desk_id
    join public.desk_members member
      on member.desk_id = channel.desk_id
      and member.user_id = auth.uid()
    where channel.id = requested_channel_id
      and workspace.archived_at is null
      and (
        channel.is_private = false
        or member.role in ('owner', 'moderator')
        or auth.uid() = any(channel.allowed_user_ids)
      )
  );
$$;

drop policy if exists "Visible Desk workspaces" on public.desk_workspaces;
create policy "Visible Desk workspaces"
  on public.desk_workspaces for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      archived_at is null
      and (
        privacy <> 'PRIVATE'
        or public.desk_is_member(desk_id)
        or exists (
          select 1 from public.desk_join_requests request
          where request.desk_id = desk_workspaces.desk_id
            and request.user_id = auth.uid()
            and request.request_type = 'invite'
            and request.status = 'pending'
        )
      )
    )
  );

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
  if workspace.archived_at is not null then raise exception 'That Desk is archived.'; end if;
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

revoke all on function public.desk_is_member(text, uuid) from public;
revoke all on function public.desk_has_role(text, text[]) from public;
revoke all on function public.desk_channel_can_view(uuid) from public;
revoke all on function public.desk_request_access(text) from public;
grant execute on function public.desk_is_member(text, uuid) to authenticated;
grant execute on function public.desk_has_role(text, text[]) to authenticated;
grant execute on function public.desk_channel_can_view(uuid) to authenticated;
grant execute on function public.desk_request_access(text) to authenticated;
