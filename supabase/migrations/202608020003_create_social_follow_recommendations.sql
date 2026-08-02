create table if not exists public.social_profile_views (
  viewer_id uuid not null references auth.users(id) on delete cascade,
  profile_user_id uuid not null references auth.users(id) on delete cascade,
  view_count integer not null default 1,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key (viewer_id, profile_user_id),
  constraint social_profile_views_no_self check (viewer_id <> profile_user_id)
);

create index if not exists social_profile_views_viewer_recent_idx
  on public.social_profile_views (viewer_id, last_viewed_at desc);

alter table public.social_profile_views enable row level security;
revoke all on table public.social_profile_views from anon;
grant select, insert, update on table public.social_profile_views to authenticated;

drop policy if exists "Users manage their own profile-view history" on public.social_profile_views;
create policy "Users manage their own profile-view history"
  on public.social_profile_views
  for all
  to authenticated
  using (auth.uid() = viewer_id)
  with check (auth.uid() = viewer_id and viewer_id <> profile_user_id);

create or replace function public.record_social_profile_view(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target_user_id is null or auth.uid() = target_user_id then
    return;
  end if;

  insert into public.social_profile_views (viewer_id, profile_user_id, view_count, first_viewed_at, last_viewed_at)
  values (auth.uid(), target_user_id, 1, now(), now())
  on conflict (viewer_id, profile_user_id)
  do update set
    view_count = social_profile_views.view_count + 1,
    last_viewed_at = excluded.last_viewed_at;
end;
$$;

create or replace function public.social_profile_recommendations(result_limit integer default 8)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  avatar_url text,
  bio text,
  mutual_follow_count bigint,
  shared_desk_count bigint,
  market_overlap_count bigint,
  recently_viewed_at timestamptz,
  follows_viewer boolean,
  viewer_follows boolean,
  relevance_score numeric,
  reason text
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select auth.uid() as id
  ),
  latest_profiles as (
    select distinct on (profile.user_id)
      profile.user_id,
      profile.author_label,
      profile.payload,
      profile.updated_at
    from public.social_objects profile
    where profile.object_type = 'profile'
    order by profile.user_id, profile.updated_at desc
  ),
  viewer_profile as (
    select profile.payload
    from latest_profiles profile, viewer
    where profile.user_id = viewer.id
    limit 1
  ),
  viewer_connections as (
    select relation.following_id as user_id
    from public.social_profile_follows relation, viewer
    where relation.follower_id = viewer.id
  ),
  mutuals as (
    select relation.following_id as candidate_id, count(*)::bigint as mutual_count
    from public.social_profile_follows relation
    join viewer_connections connection on connection.user_id = relation.follower_id
    group by relation.following_id
  ),
  viewer_desks as (
    select member.desk_id
    from public.desk_members member, viewer
    where member.user_id = viewer.id
  ),
  shared_desks as (
    select member.user_id as candidate_id, count(distinct member.desk_id)::bigint as desk_count
    from public.desk_members member
    join viewer_desks own on own.desk_id = member.desk_id
    group by member.user_id
  ),
  candidates as (
    select
      profile.user_id,
      coalesce(nullif(profile.payload ->> 'displayName', ''), nullif(profile.author_label, ''), 'Kwant User') as display_name,
      coalesce(profile.payload ->> 'handle', '') as handle,
      coalesce(profile.payload ->> 'avatarUrl', '') as avatar_url,
      left(coalesce(profile.payload ->> 'bio', ''), 240) as bio,
      coalesce(mutuals.mutual_count, 0)::bigint as mutual_follow_count,
      coalesce(shared_desks.desk_count, 0)::bigint as shared_desk_count,
      coalesce(markets.market_count, 0)::bigint as market_overlap_count,
      profile_view.last_viewed_at as recently_viewed_at,
      exists (
        select 1 from public.social_profile_follows relation, viewer
        where relation.follower_id = profile.user_id and relation.following_id = viewer.id
      ) as follows_viewer,
      exists (
        select 1 from public.social_profile_follows relation, viewer
        where relation.follower_id = viewer.id and relation.following_id = profile.user_id
      ) as viewer_follows,
      (
        least(coalesce(mutuals.mutual_count, 0), 4) * 42
        + least(coalesce(shared_desks.desk_count, 0), 2) * 30
        + least(coalesce(markets.market_count, 0), 3) * 14
        + case when exists (
            select 1 from public.social_profile_follows relation, viewer
            where relation.follower_id = profile.user_id and relation.following_id = viewer.id
          ) then 38 else 0 end
        + case
            when profile_view.last_viewed_at between now() - interval '14 days' and now() - interval '24 hours' then 46
            when profile_view.last_viewed_at > now() - interval '24 hours' then 10
            else 0
          end
        + case when profile.updated_at > now() - interval '7 days' then 8 else 0 end
      )::numeric as relevance_score
    from latest_profiles profile
    cross join viewer
    left join mutuals on mutuals.candidate_id = profile.user_id
    left join shared_desks on shared_desks.candidate_id = profile.user_id
    left join public.social_profile_views profile_view
      on profile_view.viewer_id = viewer.id and profile_view.profile_user_id = profile.user_id
    left join lateral (
      select count(*)::bigint as market_count
      from jsonb_array_elements_text(
        case when jsonb_typeof(profile.payload -> 'markets') = 'array' then profile.payload -> 'markets' else '[]'::jsonb end
      ) candidate_market
      where exists (
        select 1
        from viewer_profile own,
        jsonb_array_elements_text(
          case when jsonb_typeof(own.payload -> 'markets') = 'array' then own.payload -> 'markets' else '[]'::jsonb end
        ) viewer_market
        where upper(viewer_market.value) = upper(candidate_market.value)
      )
    ) markets on true
    where profile.user_id <> viewer.id
      and coalesce(profile.payload ->> 'handle', '') <> ''
      and not exists (
        select 1 from public.social_profile_follows relation
        where relation.follower_id = viewer.id and relation.following_id = profile.user_id
      )
  )
  select
    candidate.user_id,
    candidate.display_name,
    candidate.handle,
    candidate.avatar_url,
    candidate.bio,
    candidate.mutual_follow_count,
    candidate.shared_desk_count,
    candidate.market_overlap_count,
    candidate.recently_viewed_at,
    candidate.follows_viewer,
    candidate.viewer_follows,
    candidate.relevance_score,
    case
      when candidate.mutual_follow_count > 0 then candidate.mutual_follow_count || case when candidate.mutual_follow_count = 1 then ' mutual connection' else ' mutual connections' end
      when candidate.follows_viewer then 'Follows you'
      when candidate.shared_desk_count > 0 then 'Trades in your Desk network'
      when candidate.recently_viewed_at between now() - interval '14 days' and now() - interval '24 hours' then 'A profile you viewed yesterday'
      when candidate.market_overlap_count > 0 then 'Shared markets and trading focus'
      else 'Active in the Kwant Desk network'
    end as reason
  from candidates candidate
  order by candidate.relevance_score desc, candidate.handle asc
  limit greatest(1, least(coalesce(result_limit, 8), 20));
$$;

revoke all on function public.record_social_profile_view(uuid) from public;
revoke all on function public.social_profile_recommendations(integer) from public;
grant execute on function public.record_social_profile_view(uuid) to authenticated;
grant execute on function public.social_profile_recommendations(integer) to authenticated;
