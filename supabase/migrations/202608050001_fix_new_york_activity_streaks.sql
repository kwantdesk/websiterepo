-- Activity streaks are one account-backed record based on New York calendar
-- days. Weekends are optional but award one day when visited. Only weekday
-- elapsed time counts toward the strictly-greater-than-48-hour reset.

create table if not exists public.user_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  time_zone text not null default 'America/New_York' check (char_length(time_zone) <= 80),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table if not exists public.user_activity_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_date date,
  time_zone text not null default 'America/New_York' check (char_length(time_zone) <= 80),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_activity_streaks
  add column if not exists last_seen_at timestamptz;

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
  on public.user_activity_days for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read activity streaks" on public.user_activity_streaks;
create policy "Authenticated users can read activity streaks"
  on public.user_activity_streaks for select to authenticated
  using (true);

create or replace function public.weekday_elapsed_seconds(
  started_at timestamptz,
  ended_at timestamptz,
  requested_time_zone text default 'America/New_York'
)
returns bigint
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  safe_time_zone text := 'America/New_York';
  cursor_day date;
  final_day date;
  day_start timestamptz;
  day_end timestamptz;
  segment_start timestamptz;
  segment_end timestamptz;
  elapsed_seconds bigint := 0;
begin
  if started_at is null or ended_at is null or ended_at <= started_at then
    return 0;
  end if;

  cursor_day := (started_at at time zone safe_time_zone)::date;
  final_day := (ended_at at time zone safe_time_zone)::date;

  while cursor_day <= final_day loop
    day_start := cursor_day::timestamp at time zone safe_time_zone;
    day_end := (cursor_day + 1)::timestamp at time zone safe_time_zone;
    segment_start := greatest(started_at, day_start);
    segment_end := least(ended_at, day_end);
    if extract(isodow from cursor_day) between 1 and 5 and segment_end > segment_start then
      elapsed_seconds := elapsed_seconds + floor(extract(epoch from segment_end - segment_start))::bigint;
    end if;
    exit when elapsed_seconds > 172800;
    cursor_day := cursor_day + 1;
  end loop;

  return greatest(0, elapsed_seconds);
end;
$$;

revoke all on function public.weekday_elapsed_seconds(timestamptz, timestamptz, text) from public;

create or replace function public.record_user_activity(requested_time_zone text default 'America/New_York')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  streak_time_zone constant text := 'America/New_York';
  activity_day date := (now() at time zone streak_time_zone)::date;
  local_weekday integer := extract(isodow from (now() at time zone streak_time_zone)::date)::integer;
  prior_streak public.user_activity_streaks%rowtype;
  already_counted boolean := false;
  elapsed_weekday_seconds bigint := 0;
  next_streak integer := 1;
  next_longest integer := 1;
  reset_streak boolean := false;
begin
  if viewer_id is null then
    raise exception 'Authentication required';
  end if;

  select * into prior_streak
  from public.user_activity_streaks
  where user_id = viewer_id
  for update;

  select exists (
    select 1
    from public.user_activity_days activity
    where activity.user_id = viewer_id
      and activity.activity_date = activity_day
  ) into already_counted;

  if prior_streak.user_id is not null then
    elapsed_weekday_seconds := public.weekday_elapsed_seconds(
      coalesce(prior_streak.last_seen_at, prior_streak.updated_at),
      now(),
      streak_time_zone
    );
  end if;

  insert into public.user_activity_days (
    user_id, activity_date, time_zone, first_seen_at, last_seen_at
  ) values (
    viewer_id, activity_day, streak_time_zone, now(), now()
  )
  on conflict (user_id, activity_date)
  do update set
    last_seen_at = excluded.last_seen_at,
    time_zone = excluded.time_zone;

  if prior_streak.user_id is null then
    insert into public.user_activity_streaks (
      user_id, current_streak, longest_streak, last_active_date,
      time_zone, last_seen_at, updated_at
    ) values (
      viewer_id, 1, 1, activity_day,
      streak_time_zone, now(), now()
    );
  elsif already_counted then
    next_streak := greatest(1, prior_streak.current_streak);
    next_longest := greatest(prior_streak.longest_streak, next_streak);
    update public.user_activity_streaks
    set current_streak = next_streak,
        longest_streak = next_longest,
        last_active_date = activity_day,
        time_zone = streak_time_zone,
        last_seen_at = now(),
        updated_at = now()
    where user_id = viewer_id;
  else
    reset_streak := elapsed_weekday_seconds > 172800;
    next_streak := case
      when reset_streak then 1
      else greatest(1, prior_streak.current_streak) + 1
    end;
    next_longest := greatest(prior_streak.longest_streak, next_streak);
    update public.user_activity_streaks
    set current_streak = next_streak,
        longest_streak = next_longest,
        last_active_date = activity_day,
        time_zone = streak_time_zone,
        last_seen_at = now(),
        updated_at = now()
    where user_id = viewer_id;
  end if;

  return jsonb_build_object(
    'currentStreak', next_streak,
    'longestStreak', next_longest,
    'lastActivityDate', activity_day,
    'activityDate', activity_day,
    'counted', not already_counted,
    'dayCredit', case when already_counted then 0 else 1 end,
    'weekend', local_weekday in (6, 7),
    'reset', reset_streak,
    'weekdayElapsedSeconds', elapsed_weekday_seconds,
    'lastSeenAt', now(),
    'timeZone', streak_time_zone
  );
end;
$$;

revoke all on function public.record_user_activity(text) from public;
grant execute on function public.record_user_activity(text) to authenticated;

-- Requested owner correction: make the existing Kwant Desk account's live
-- record five without creating five artificial weekend bonus days.
insert into public.user_activity_days (
  user_id, activity_date, time_zone, first_seen_at, last_seen_at
)
select
  id,
  (now() at time zone 'America/New_York')::date,
  'America/New_York',
  now(),
  now()
from auth.users
where lower(email) = 'kwantdesk@gmail.com'
on conflict (user_id, activity_date)
do update set
  last_seen_at = excluded.last_seen_at,
  time_zone = excluded.time_zone;

insert into public.user_activity_streaks (
  user_id, current_streak, longest_streak, last_active_date,
  time_zone, last_seen_at, updated_at
)
select
  id,
  5,
  5,
  (now() at time zone 'America/New_York')::date,
  'America/New_York',
  now(),
  now()
from auth.users
where lower(email) = 'kwantdesk@gmail.com'
on conflict (user_id)
do update set
  current_streak = 5,
  longest_streak = greatest(public.user_activity_streaks.longest_streak, 5),
  last_active_date = excluded.last_active_date,
  time_zone = excluded.time_zone,
  last_seen_at = excluded.last_seen_at,
  updated_at = excluded.updated_at;

update public.social_objects
set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
      'activityStreak', 5,
      'longestActivityStreak', greatest(
        5,
        case
          when coalesce(payload->>'longestActivityStreak', '') ~ '^\d+$'
            then (payload->>'longestActivityStreak')::integer
          else 0
        end
      ),
      'lastActivityDate', (now() at time zone 'America/New_York')::date::text,
      'lastSeenAt', now()::text
    ),
    updated_at = now()
where id = 'profile'
  and object_type = 'profile'
  and user_id in (
    select id from auth.users where lower(email) = 'kwantdesk@gmail.com'
  );
