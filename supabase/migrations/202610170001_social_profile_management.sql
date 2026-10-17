-- Preserve the immutable trading thesis/hash while permitting owner publication controls.
create or replace function public.protect_locked_social_precord()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.object_type = 'precord' then
    if (to_jsonb(new) - 'scope' - 'updated_at' - 'payload') is distinct from
       (to_jsonb(old) - 'scope' - 'updated_at' - 'payload')
       or (new.payload - 'profileArchivedAt' - 'profileArchiveScope' - 'profileCaption') is distinct from
          (old.payload - 'profileArchivedAt' - 'profileArchiveScope' - 'profileCaption') then
      raise exception 'Locked Gameplan trading fields are immutable. Only profile presentation can change.';
    end if;
    if coalesce(new.payload->>'profileArchivedAt', '') <> '' and new.scope <> 'private' then
      raise exception 'Archived profile records must be private.';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
