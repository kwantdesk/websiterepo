create extension if not exists pgcrypto;

create table if not exists public.desktop_access_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  scopes text[] not null default '{}'::text[],
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint desktop_access_entitlements_scopes_allowed check (
    scopes <@ array[
      'market.trades:read',
      'market.depth:read',
      'market.replay:read',
      'market.indices:read',
      'lab.snapshot:read'
    ]::text[]
    and not ('*' = any(scopes))
    and (not enabled or cardinality(scopes) > 0)
  )
);

create table if not exists public.desktop_authorization_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_challenge text not null,
  redirect_uri text not null,
  scopes text[] not null,
  client_version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint desktop_authorization_codes_hash_shape check (code_hash ~ '^[a-f0-9]{64}$'),
  constraint desktop_authorization_codes_challenge_shape check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  constraint desktop_authorization_codes_redirect_shape check (
    redirect_uri ~ '^http://127\.0\.0\.1:[0-9]{1,5}/desktop-auth/callback/$'
  ),
  constraint desktop_authorization_codes_scopes_allowed check (
    scopes <@ array[
      'market.trades:read',
      'market.depth:read',
      'market.replay:read',
      'market.indices:read',
      'lab.snapshot:read'
    ]::text[]
    and cardinality(scopes) > 0
    and not ('*' = any(scopes))
  ),
  constraint desktop_authorization_codes_lifetime check (
    expires_at > created_at and expires_at <= created_at + interval '60 seconds'
  )
);

create index if not exists desktop_authorization_codes_expiry_idx
  on public.desktop_authorization_codes (expires_at);

create table if not exists public.desktop_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scopes text[] not null,
  client_version text not null,
  last_ticket_jti text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text,
  constraint desktop_sessions_last_ticket_shape check (
    last_ticket_jti is null or last_ticket_jti ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  constraint desktop_sessions_scopes_explicit check (
    cardinality(scopes) > 0 and not ('*' = any(scopes))
  ),
  constraint desktop_sessions_lifetime check (
    expires_at > created_at and expires_at <= created_at + interval '31 days'
  )
);

create index if not exists desktop_sessions_user_idx
  on public.desktop_sessions (user_id, created_at desc);

create index if not exists desktop_sessions_expiry_idx
  on public.desktop_sessions (expires_at);

create index if not exists desktop_sessions_revoked_idx
  on public.desktop_sessions (revoked_at)
  where revoked_at is not null;

create table if not exists public.desktop_refresh_handles (
  handle_hash text primary key,
  session_id uuid not null references public.desktop_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  replacement_hash text,
  constraint desktop_refresh_handles_hash_shape check (handle_hash ~ '^[a-f0-9]{64}$'),
  constraint desktop_refresh_handles_replacement_shape check (
    replacement_hash is null or replacement_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint desktop_refresh_handles_lifetime check (expires_at > created_at)
);

create index if not exists desktop_refresh_handles_session_idx
  on public.desktop_refresh_handles (session_id, created_at desc);

create index if not exists desktop_refresh_handles_expiry_idx
  on public.desktop_refresh_handles (expires_at);

create table if not exists public.desktop_revoked_ticket_ids (
  jti text primary key,
  session_id uuid not null references public.desktop_sessions(id) on delete cascade,
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason text not null,
  constraint desktop_revoked_ticket_ids_jti_shape check (
    jti ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
);

create index if not exists desktop_revoked_ticket_ids_session_idx
  on public.desktop_revoked_ticket_ids (session_id);

create index if not exists desktop_revoked_ticket_ids_expiry_idx
  on public.desktop_revoked_ticket_ids (expires_at);

alter table public.desktop_access_entitlements enable row level security;
alter table public.desktop_authorization_codes enable row level security;
alter table public.desktop_sessions enable row level security;
alter table public.desktop_refresh_handles enable row level security;
alter table public.desktop_revoked_ticket_ids enable row level security;

revoke all on public.desktop_access_entitlements from public, anon, authenticated;
revoke all on public.desktop_authorization_codes from public, anon, authenticated;
revoke all on public.desktop_sessions from public, anon, authenticated;
revoke all on public.desktop_refresh_handles from public, anon, authenticated;
revoke all on public.desktop_revoked_ticket_ids from public, anon, authenticated;

grant select, insert, update, delete on public.desktop_access_entitlements to service_role;
grant select, insert, update, delete on public.desktop_authorization_codes to service_role;
grant select, insert, update, delete on public.desktop_sessions to service_role;
grant select, insert, update, delete on public.desktop_refresh_handles to service_role;
grant select, insert, update, delete on public.desktop_revoked_ticket_ids to service_role;

create or replace function public.desktop_exchange_authorization_code(
  requested_code_hash text,
  requested_redirect_uri text,
  new_refresh_hash text,
  new_refresh_expires_at timestamptz,
  new_ticket_jti text
)
returns table (
  session_id uuid,
  user_id uuid,
  granted_scopes text[],
  client_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_row public.desktop_authorization_codes%rowtype;
  entitlement_row public.desktop_access_entitlements%rowtype;
  created_session_id uuid;
  current_time timestamptz := statement_timestamp();
begin
  if requested_code_hash !~ '^[a-f0-9]{64}$'
    or new_refresh_hash !~ '^[a-f0-9]{64}$'
    or new_ticket_jti !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or new_refresh_expires_at <= current_time
    or new_refresh_expires_at > current_time + interval '31 days'
  then
    return;
  end if;

  select * into code_row
  from public.desktop_authorization_codes
  where code_hash = requested_code_hash
    and redirect_uri = requested_redirect_uri
  for update;

  if not found
    or code_row.consumed_at is not null
    or code_row.expires_at <= current_time
  then
    return;
  end if;

  select * into entitlement_row
  from public.desktop_access_entitlements
  where desktop_access_entitlements.user_id = code_row.user_id
  for update;

  if not found
    or not entitlement_row.enabled
    or (entitlement_row.expires_at is not null and entitlement_row.expires_at <= current_time)
    or not (code_row.scopes <@ entitlement_row.scopes)
  then
    return;
  end if;

  update public.desktop_authorization_codes
  set consumed_at = current_time
  where code_hash = code_row.code_hash;

  insert into public.desktop_sessions (
    user_id,
    scopes,
    client_version,
    last_ticket_jti,
    created_at,
    expires_at
  ) values (
    code_row.user_id,
    code_row.scopes,
    code_row.client_version,
    new_ticket_jti,
    current_time,
    new_refresh_expires_at
  )
  returning id into created_session_id;

  insert into public.desktop_refresh_handles (
    handle_hash,
    session_id,
    created_at,
    expires_at
  ) values (
    new_refresh_hash,
    created_session_id,
    current_time,
    new_refresh_expires_at
  );

  return query
  select created_session_id, code_row.user_id, code_row.scopes, code_row.client_version;
end;
$$;

create or replace function public.desktop_rotate_refresh_handle(
  current_refresh_hash text,
  next_refresh_hash text,
  next_refresh_expires_at timestamptz,
  next_ticket_jti text
)
returns table (
  session_id uuid,
  user_id uuid,
  granted_scopes text[],
  client_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  handle_row public.desktop_refresh_handles%rowtype;
  session_row public.desktop_sessions%rowtype;
  entitlement_row public.desktop_access_entitlements%rowtype;
  current_time timestamptz := statement_timestamp();
begin
  if current_refresh_hash !~ '^[a-f0-9]{64}$'
    or next_refresh_hash !~ '^[a-f0-9]{64}$'
    or next_ticket_jti !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or next_refresh_expires_at <= current_time
    or next_refresh_expires_at > current_time + interval '31 days'
  then
    return;
  end if;

  select * into handle_row
  from public.desktop_refresh_handles
  where handle_hash = current_refresh_hash
  for update;

  if not found then
    return;
  end if;

  select * into session_row
  from public.desktop_sessions
  where id = handle_row.session_id
  for update;

  if not found then
    return;
  end if;

  if handle_row.consumed_at is not null then
    update public.desktop_sessions
    set revoked_at = coalesce(revoked_at, current_time),
        revoke_reason = coalesce(revoke_reason, 'refresh_replay')
    where id = session_row.id;

    update public.desktop_refresh_handles
    set revoked_at = coalesce(revoked_at, current_time)
    where desktop_refresh_handles.session_id = session_row.id;

    if session_row.last_ticket_jti is not null then
      insert into public.desktop_revoked_ticket_ids (jti, session_id, revoked_at, expires_at, reason)
      values (
        session_row.last_ticket_jti,
        session_row.id,
        current_time,
        current_time + interval '5 minutes',
        'refresh_replay'
      )
      on conflict (jti) do nothing;
    end if;
    return;
  end if;

  if handle_row.revoked_at is not null
    or handle_row.expires_at <= current_time
    or session_row.revoked_at is not null
    or session_row.expires_at <= current_time
  then
    return;
  end if;

  select * into entitlement_row
  from public.desktop_access_entitlements
  where desktop_access_entitlements.user_id = session_row.user_id
  for update;

  if not found
    or not entitlement_row.enabled
    or (entitlement_row.expires_at is not null and entitlement_row.expires_at <= current_time)
    or not (session_row.scopes <@ entitlement_row.scopes)
  then
    update public.desktop_sessions
    set revoked_at = coalesce(revoked_at, current_time),
        revoke_reason = coalesce(revoke_reason, 'entitlement_removed')
    where id = session_row.id;
    update public.desktop_refresh_handles
    set revoked_at = coalesce(revoked_at, current_time)
    where desktop_refresh_handles.session_id = session_row.id;
    return;
  end if;

  update public.desktop_refresh_handles
  set consumed_at = current_time,
      replacement_hash = next_refresh_hash
  where handle_hash = handle_row.handle_hash;

  insert into public.desktop_refresh_handles (
    handle_hash,
    session_id,
    created_at,
    expires_at
  ) values (
    next_refresh_hash,
    session_row.id,
    current_time,
    least(next_refresh_expires_at, session_row.expires_at)
  );

  update public.desktop_sessions
  set last_ticket_jti = next_ticket_jti
  where id = session_row.id;

  return query
  select session_row.id, session_row.user_id, session_row.scopes, session_row.client_version;
end;
$$;

create or replace function public.desktop_revoke_session(
  requested_refresh_hash text,
  requested_reason text default 'sign_out'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  handle_row public.desktop_refresh_handles%rowtype;
  session_row public.desktop_sessions%rowtype;
  current_time timestamptz := statement_timestamp();
begin
  if requested_refresh_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select * into handle_row
  from public.desktop_refresh_handles
  where handle_hash = requested_refresh_hash
  for update;

  if not found then
    return false;
  end if;

  select * into session_row
  from public.desktop_sessions
  where id = handle_row.session_id
  for update;

  if not found then
    return false;
  end if;

  update public.desktop_sessions
  set revoked_at = coalesce(revoked_at, current_time),
      revoke_reason = coalesce(revoke_reason, left(coalesce(requested_reason, 'sign_out'), 80))
  where id = session_row.id;

  update public.desktop_refresh_handles
  set revoked_at = coalesce(revoked_at, current_time)
  where desktop_refresh_handles.session_id = session_row.id;

  if session_row.last_ticket_jti is not null then
    insert into public.desktop_revoked_ticket_ids (jti, session_id, revoked_at, expires_at, reason)
    values (
      session_row.last_ticket_jti,
      session_row.id,
      current_time,
      current_time + interval '5 minutes',
      left(coalesce(requested_reason, 'sign_out'), 80)
    )
    on conflict (jti) do nothing;
  end if;

  return true;
end;
$$;

create or replace function public.desktop_ticket_is_revoked(
  requested_jti text,
  requested_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.desktop_sessions
    where id = requested_session_id
      and revoked_at is null
      and expires_at > statement_timestamp()
  ) or exists (
    select 1
    from public.desktop_revoked_ticket_ids
    where jti = requested_jti
      and session_id = requested_session_id
      and expires_at > statement_timestamp()
  );
$$;

create or replace function public.desktop_auth_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.desktop_authorization_codes
  where expires_at < statement_timestamp() - interval '1 day';

  delete from public.desktop_revoked_ticket_ids
  where expires_at < statement_timestamp() - interval '1 day';

  delete from public.desktop_sessions
  where expires_at < statement_timestamp() - interval '7 days'
     or revoked_at < statement_timestamp() - interval '31 days';
end;
$$;

revoke all on function public.desktop_exchange_authorization_code(text, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.desktop_rotate_refresh_handle(text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.desktop_revoke_session(text, text) from public, anon, authenticated;
revoke all on function public.desktop_ticket_is_revoked(text, uuid) from public, anon, authenticated;
revoke all on function public.desktop_auth_cleanup() from public, anon, authenticated;

grant execute on function public.desktop_exchange_authorization_code(text, text, text, timestamptz, text) to service_role;
grant execute on function public.desktop_rotate_refresh_handle(text, text, timestamptz, text) to service_role;
grant execute on function public.desktop_revoke_session(text, text) to service_role;
grant execute on function public.desktop_ticket_is_revoked(text, uuid) to service_role;
grant execute on function public.desktop_auth_cleanup() to service_role;
