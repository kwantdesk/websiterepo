create table if not exists public.user_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  time_zone text not null default 'UTC' check (char_length(time_zone) <= 80),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table if not exists public.user_activity_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_date date,
  time_zone text not null default 'UTC' check (char_length(time_zone) <= 80),
  updated_at timestamptz not null default now()
);

create index if not exists user_activity_days_date_idx
  on public.user_activity_days (activity_date desc, user_id);

alter table public.user_activity_days enable row level security;
alter table public.user_activity_streaks enable row level security;

revoke all on table public.user_activity_days from anon;
revoke all on table public.user_activity_streaks from anon;
revoke insert, update, delete on table public.user_activity_days from authenticated;
revoke insert, update, delete on table public.user_activity_streaks from authenticated;
grant select on table public.user_activity_days to authenticated;
grant select on table public.user_activity_streaks to authenticated;

drop policy if exists "Users can read their own activity days" on public.user_activity_days;
create policy "Users can read their own activity days"
  on public.user_activity_days
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read activity streaks" on public.user_activity_streaks;
create policy "Authenticated users can read activity streaks"
  on public.user_activity_streaks
  for select
  to authenticated
  using (true);

create or replace function public.record_user_activity(requested_time_zone text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  safe_time_zone text := 'UTC';
  local_day date;
  local_weekday integer;
  prior_streak public.user_activity_streaks%rowtype;
  business_day_gap integer := 0;
  next_streak integer := 0;
  next_longest integer := 0;
begin
  if viewer_id is null then
    raise exception 'Authentication required';
  end if;

  select name
    into safe_time_zone
    from pg_timezone_names
   where name = left(coalesce(nullif(trim(requested_time_zone), ''), 'UTC'), 80)
   limit 1;
  safe_time_zone := coalesce(safe_time_zone, 'UTC');

  local_day := (now() at time zone safe_time_zone)::date;
  local_weekday := extract(isodow from local_day)::integer;

  select *
    into prior_streak
    from public.user_activity_streaks
   where user_id = viewer_id
   for update;

  -- Weekends do not add a day and never break an existing streak.
  if local_weekday in (6, 7) then
    return jsonb_build_object(
      'currentStreak', coalesce(prior_streak.current_streak, 0),
      'longestStreak', coalesce(prior_streak.longest_streak, 0),
      'lastActivityDate', prior_streak.last_active_date,
      'activityDate', local_day,
      'counted', false,
      'timeZone', safe_time_zone
    );
  end if;

  insert into public.user_activity_days (
    user_id,
    activity_date,
    time_zone,
    first_seen_at,
    last_seen_at
  ) values (
    viewer_id,
    local_day,
    safe_time_zone,
    now(),
    now()
  )
  on conflict (user_id, activity_date)
  do update set
    last_seen_at = excluded.last_seen_at,
    time_zone = excluded.time_zone;

  if prior_streak.user_id is null then
    next_streak := 1;
    next_longest := 1;
    insert into public.user_activity_streaks (
      user_id,
      current_streak,
      longest_streak,
      last_active_date,
      time_zone,
      updated_at
    ) values (
      viewer_id,
      next_streak,
      next_longest,
      local_day,
      safe_time_zone,
      now()
    );
  elsif prior_streak.last_active_date = local_day or prior_streak.last_active_date > local_day then
    next_streak := prior_streak.current_streak;
    next_longest := prior_streak.longest_streak;
    update public.user_activity_streaks
       set time_zone = safe_time_zone,
           updated_at = now()
     where user_id = viewer_id;
  else
    select count(*)::integer
      into business_day_gap
      from generate_series(
        prior_streak.last_active_date + 1,
        local_day,
        interval '1 day'
      ) as candidate(day)
     where extract(isodow from candidate.day) between 1 and 5;

    -- A single missed weekday remains inside the 48-hour grace window.
    next_streak := case
      when business_day_gap <= 2 then prior_streak.current_streak + 1
      else 1
    end;
    next_longest := greatest(prior_streak.longest_streak, next_streak);

    update public.user_activity_streaks
       set current_streak = next_streak,
           longest_streak = next_longest,
           last_active_date = local_day,
           time_zone = safe_time_zone,
           updated_at = now()
     where user_id = viewer_id;
  end if;

  return jsonb_build_object(
    'currentStreak', next_streak,
    'longestStreak', next_longest,
    'lastActivityDate', local_day,
    'activityDate', local_day,
    'counted', true,
    'timeZone', safe_time_zone
  );
end;
$$;

revoke all on function public.record_user_activity(text) from public;
grant execute on function public.record_user_activity(text) to authenticated;
