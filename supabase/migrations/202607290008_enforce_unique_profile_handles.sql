create unique index if not exists social_profile_handle_unique_idx
  on public.social_objects (lower(payload ->> 'handle'))
  where object_type = 'profile'
    and nullif(payload ->> 'handle', '') is not null;
