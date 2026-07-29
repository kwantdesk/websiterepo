create table if not exists public.friend_chats (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 240),
  created_by uuid not null references auth.users(id) on delete cascade,
  allow_member_invites boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_chat_members (
  chat_id uuid not null references public.friend_chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  muted boolean not null default false,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.friend_chat_messages (
  id uuid primary key,
  chat_id uuid not null references public.friend_chats(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint friend_chat_message_content check (
    char_length(trim(body)) > 0 or jsonb_array_length(attachments) > 0
  ),
  constraint friend_chat_attachment_payload_size check (
    octet_length(attachments::text) <= 2800000
  )
);

create index if not exists friend_chat_members_user_idx
  on public.friend_chat_members (user_id, joined_at desc);

create index if not exists friend_chat_messages_chat_idx
  on public.friend_chat_messages (chat_id, created_at desc);

alter table public.friend_chats enable row level security;
alter table public.friend_chat_members enable row level security;
alter table public.friend_chat_messages enable row level security;

revoke all on table public.friend_chats from anon;
revoke all on table public.friend_chat_members from anon;
revoke all on table public.friend_chat_messages from anon;
grant select, insert, update, delete on table public.friend_chats to authenticated;
grant select, insert, update, delete on table public.friend_chat_members to authenticated;
grant select, insert, delete on table public.friend_chat_messages to authenticated;

create or replace function public.friend_chat_is_member(requested_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friend_chat_members member
    where member.chat_id = requested_chat_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.friend_chat_is_owner(requested_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friend_chat_members member
    where member.chat_id = requested_chat_id
      and member.user_id = auth.uid()
      and member.role = 'owner'
  );
$$;

revoke all on function public.friend_chat_is_member(uuid) from public;
revoke all on function public.friend_chat_is_owner(uuid) from public;
grant execute on function public.friend_chat_is_member(uuid) to authenticated;
grant execute on function public.friend_chat_is_owner(uuid) to authenticated;

drop policy if exists "Members read friend chats" on public.friend_chats;
create policy "Members read friend chats"
  on public.friend_chats for select to authenticated
  using (
    public.friend_chat_is_member(id)
    or created_by = auth.uid()
  );

drop policy if exists "Users create friend chats" on public.friend_chats;
create policy "Users create friend chats"
  on public.friend_chats for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Owners update friend chats" on public.friend_chats;
create policy "Owners update friend chats"
  on public.friend_chats for update to authenticated
  using (public.friend_chat_is_owner(id))
  with check (public.friend_chat_is_owner(id));

drop policy if exists "Owners delete friend chats" on public.friend_chats;
create policy "Owners delete friend chats"
  on public.friend_chats for delete to authenticated
  using (public.friend_chat_is_owner(id));

drop policy if exists "Members read chat membership" on public.friend_chat_members;
create policy "Members read chat membership"
  on public.friend_chat_members for select to authenticated
  using (
    public.friend_chat_is_member(chat_id)
    or exists (
      select 1
      from public.friend_chats chat
      where chat.id = chat_id
        and chat.created_by = auth.uid()
    )
  );

drop policy if exists "Owners add chat members" on public.friend_chat_members;
create policy "Owners add chat members"
  on public.friend_chat_members for insert to authenticated
  with check (
    public.friend_chat_is_owner(chat_id)
    or (
      public.friend_chat_is_member(chat_id)
      and exists (
        select 1
        from public.friend_chats chat
        where chat.id = chat_id
          and chat.allow_member_invites = true
      )
    )
    or (
      user_id = auth.uid()
      and exists (
        select 1
        from public.friend_chats chat
        where chat.id = chat_id
          and chat.created_by = auth.uid()
      )
    )
  );

drop policy if exists "Members update chat membership" on public.friend_chat_members;
create policy "Members update chat membership"
  on public.friend_chat_members for update to authenticated
  using (user_id = auth.uid() or public.friend_chat_is_owner(chat_id))
  with check (user_id = auth.uid() or public.friend_chat_is_owner(chat_id));

drop policy if exists "Members leave or owners remove members" on public.friend_chat_members;
create policy "Members leave or owners remove members"
  on public.friend_chat_members for delete to authenticated
  using (user_id = auth.uid() or public.friend_chat_is_owner(chat_id));

drop policy if exists "Members read friend chat messages" on public.friend_chat_messages;
create policy "Members read friend chat messages"
  on public.friend_chat_messages for select to authenticated
  using (public.friend_chat_is_member(chat_id));

drop policy if exists "Members send friend chat messages" on public.friend_chat_messages;
create policy "Members send friend chat messages"
  on public.friend_chat_messages for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and public.friend_chat_is_member(chat_id)
  );

drop policy if exists "Senders or owners delete friend chat messages" on public.friend_chat_messages;
create policy "Senders or owners delete friend chat messages"
  on public.friend_chat_messages for delete to authenticated
  using (
    sender_user_id = auth.uid()
    or public.friend_chat_is_owner(chat_id)
  );

do $$
begin
  alter publication supabase_realtime add table public.friend_chats;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.friend_chat_members;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.friend_chat_messages;
exception
  when duplicate_object then null;
end
$$;
