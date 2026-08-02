alter table public.user_activity_streaks
  add column if not exists last_seen_at timestamptz;

update public.user_activity_streaks
set last_seen_at = coalesce(last_seen_at, updated_at, now())
where last_seen_at is null;

create or replace function public.weekday_elapsed_seconds(
  started_at timestamptz,
  ended_at timestamptz,
  requested_time_zone text default 'UTC'
)
returns bigint
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  safe_time_zone text := 'UTC';
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

  select name into safe_time_zone
  from pg_timezone_names
  where name = left(coalesce(nullif(trim(requested_time_zone), ''), 'UTC'), 80)
  limit 1;
  safe_time_zone := coalesce(safe_time_zone, 'UTC');

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
  already_counted boolean := false;
  elapsed_weekday_seconds bigint := 0;
  day_credit integer := 1;
  next_streak integer := 0;
  next_longest integer := 0;
  recovered boolean := false;
  reset_streak boolean := false;
begin
  if viewer_id is null then
    raise exception 'Authentication required';
  end if;

  select name into safe_time_zone
  from pg_timezone_names
  where name = left(coalesce(nullif(trim(requested_time_zone), ''), 'UTC'), 80)
  limit 1;
  safe_time_zone := coalesce(safe_time_zone, 'UTC');

  local_day := (now() at time zone safe_time_zone)::date;
  local_weekday := extract(isodow from local_day)::integer;
  day_credit := case when local_weekday in (6, 7) then 5 else 1 end;

  select * into prior_streak
  from public.user_activity_streaks
  where user_id = viewer_id
  for update;

  select exists (
    select 1 from public.user_activity_days activity
    where activity.user_id = viewer_id and activity.activity_date = local_day
  ) into already_counted;

  if prior_streak.user_id is not null then
    elapsed_weekday_seconds := public.weekday_elapsed_seconds(
      coalesce(prior_streak.last_seen_at, prior_streak.updated_at),
      now(),
      safe_time_zone
    );
  end if;

  insert into public.user_activity_days (
    user_id, activity_date, time_zone, first_seen_at, last_seen_at
  ) values (
    viewer_id, local_day, safe_time_zone, now(), now()
  )
  on conflict (user_id, activity_date)
  do update set last_seen_at = excluded.last_seen_at, time_zone = excluded.time_zone;

  if prior_streak.user_id is null then
    next_streak := day_credit;
    next_longest := day_credit;
    insert into public.user_activity_streaks (
      user_id, current_streak, longest_streak, last_active_date, time_zone, last_seen_at, updated_at
    ) values (
      viewer_id, next_streak, next_longest, local_day, safe_time_zone, now(), now()
    );
  elsif already_counted then
    next_streak := prior_streak.current_streak;
    next_longest := prior_streak.longest_streak;
    update public.user_activity_streaks
    set time_zone = safe_time_zone, last_seen_at = now(), updated_at = now()
    where user_id = viewer_id;
  else
    recovered := elapsed_weekday_seconds >= 86400 and elapsed_weekday_seconds < 172800;
    reset_streak := elapsed_weekday_seconds >= 172800;
    next_streak := case
      when reset_streak then day_credit
      else prior_streak.current_streak + day_credit
    end;
    next_longest := greatest(prior_streak.longest_streak, next_streak);
    update public.user_activity_streaks
    set current_streak = next_streak,
        longest_streak = next_longest,
        last_active_date = local_day,
        time_zone = safe_time_zone,
        last_seen_at = now(),
        updated_at = now()
    where user_id = viewer_id;
  end if;

  return jsonb_build_object(
    'currentStreak', next_streak,
    'longestStreak', next_longest,
    'lastActivityDate', local_day,
    'activityDate', local_day,
    'counted', not already_counted,
    'dayCredit', case when already_counted then 0 else day_credit end,
    'weekendBoost', local_weekday in (6, 7) and not already_counted,
    'recovered', recovered,
    'reset', reset_streak,
    'weekdayElapsedSeconds', elapsed_weekday_seconds,
    'lastSeenAt', now(),
    'timeZone', safe_time_zone
  );
end;
$$;

revoke all on function public.weekday_elapsed_seconds(timestamptz, timestamptz, text) from public;
revoke all on function public.record_user_activity(text) from public;
grant execute on function public.record_user_activity(text) to authenticated;
