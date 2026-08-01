alter table public.social_objects
  drop constraint if exists social_profile_handle_format_check;

alter table public.social_objects
  add constraint social_profile_handle_format_check
  check (
    object_type <> 'profile'
    or (
      coalesce(payload ->> 'handle', '') ~ '^[a-z][a-z0-9_]{2,23}$'
      and length(regexp_replace(coalesce(payload ->> 'handle', ''), '[^a-z]', '', 'g')) >= 3
    )
  ) not valid;

comment on constraint social_profile_handle_format_check on public.social_objects is
  'New and updated profile handles must be 3-24 characters, begin with a letter, contain at least three letters, and use only lowercase letters, numbers, or underscores.';
