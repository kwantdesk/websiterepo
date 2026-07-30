create table if not exists public.desk_focus_locks (
  desk_id text primary key references public.desk_workspaces(desk_id) on delete cascade,
  locked_by uuid not null references auth.users(id) on delete cascade,
  locked_at timestamptz not null default now()
);

create index if not exists desk_focus_locks_actor_idx
  on public.desk_focus_locks (locked_by, locked_at desc);

alter table public.desk_focus_locks enable row level security;

revoke all on table public.desk_focus_locks from anon;
revoke insert, update, delete on table public.desk_focus_locks from authenticated;
grant select on table public.desk_focus_locks to authenticated;

drop policy if exists "Members view Desk focus locks" on public.desk_focus_locks;
create policy "Members view Desk focus locks"
  on public.desk_focus_locks for select to authenticated
  using (public.desk_is_member(desk_id));

create or replace function public.desk_set_focus_lock(
  requested_desk_id text,
  next_locked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  current_lock public.desk_focus_locks%rowtype;
begin
  if actor_id is null or not public.desk_is_member(requested_desk_id, actor_id) then
    raise exception 'Only Desk members can control trading focus mode.';
  end if;

  select * into current_lock
  from public.desk_focus_locks
  where desk_id = requested_desk_id
  for update;

  if next_locked then
    if current_lock.desk_id is null then
      insert into public.desk_focus_locks (desk_id, locked_by, locked_at)
      values (requested_desk_id, actor_id, now())
      on conflict (desk_id) do nothing;
    end if;
  else
    if current_lock.desk_id is null then
      return jsonb_build_object('locked', false, 'deskId', requested_desk_id);
    end if;
    if current_lock.locked_by <> actor_id
      and not public.desk_has_role(requested_desk_id, array['owner', 'moderator']) then
      raise exception 'Only the trader who silenced this Desk or a Desk leader can reopen it.';
    end if;
    delete from public.desk_focus_locks where desk_id = requested_desk_id;
  end if;

  select * into current_lock
  from public.desk_focus_locks
  where desk_id = requested_desk_id;

  return jsonb_build_object(
    'locked', current_lock.desk_id is not null,
    'deskId', requested_desk_id,
    'lockedBy', current_lock.locked_by,
    'lockedAt', current_lock.locked_at
  );
end;
$$;

revoke all on function public.desk_set_focus_lock(text, boolean) from public;
grant execute on function public.desk_set_focus_lock(text, boolean) to authenticated;

drop policy if exists "Members send permitted Desk messages" on public.desk_messages;
create policy "Members send permitted Desk messages"
  on public.desk_messages for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and not exists (
      select 1
      from public.desk_focus_locks focus
      where focus.desk_id = desk_messages.desk_id
    )
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
    not exists (
      select 1
      from public.desk_focus_locks focus
      where focus.desk_id = desk_messages.desk_id
    )
    and (
      sender_user_id = auth.uid()
      or public.desk_has_role(desk_id, array['owner', 'moderator'])
    )
  );

drop policy if exists "Members add Desk reactions" on public.desk_message_reactions;
create policy "Members add Desk reactions"
  on public.desk_message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.desk_message_can_view(message_id)
    and not exists (
      select 1
      from public.desk_messages message
      join public.desk_focus_locks focus on focus.desk_id = message.desk_id
      where message.id = desk_message_reactions.message_id
    )
  );

drop policy if exists "Members remove their Desk reactions" on public.desk_message_reactions;
create policy "Members remove their Desk reactions"
  on public.desk_message_reactions for delete to authenticated
  using (
    user_id = auth.uid()
    and not exists (
      select 1
      from public.desk_messages message
      join public.desk_focus_locks focus on focus.desk_id = message.desk_id
      where message.id = desk_message_reactions.message_id
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.desk_focus_locks;
exception when duplicate_object then null;
end
$$;
