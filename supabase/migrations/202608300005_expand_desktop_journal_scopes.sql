alter table public.desktop_access_entitlements
  drop constraint if exists desktop_access_entitlements_scopes_allowed;
alter table public.desktop_access_entitlements
  add constraint desktop_access_entitlements_scopes_allowed check (
    scopes <@ array[
      'market.trades:read', 'market.depth:read', 'market.replay:read',
      'market.indices:read', 'lab.snapshot:read', 'options.analytics:read',
      'assistant.zyon:read', 'assistant.zyon:write',
      'news.intelligence:read', 'news.intelligence:write',
      'socials.account:read', 'socials.account:write',
      'journal.account:read', 'journal.account:write'
    ]::text[]
    and not ('*' = any(scopes))
    and (not enabled or cardinality(scopes) > 0)
  );

alter table public.desktop_authorization_codes
  drop constraint if exists desktop_authorization_codes_scopes_allowed;
alter table public.desktop_authorization_codes
  add constraint desktop_authorization_codes_scopes_allowed check (
    scopes <@ array[
      'market.trades:read', 'market.depth:read', 'market.replay:read',
      'market.indices:read', 'lab.snapshot:read', 'options.analytics:read',
      'assistant.zyon:read', 'assistant.zyon:write',
      'news.intelligence:read', 'news.intelligence:write',
      'socials.account:read', 'socials.account:write',
      'journal.account:read', 'journal.account:write'
    ]::text[]
    and cardinality(scopes) > 0
    and not ('*' = any(scopes))
  );

comment on constraint desktop_access_entitlements_scopes_allowed
  on public.desktop_access_entitlements is
  'Explicit native workstation grants including private Journal read/write; this allowlist never grants a scope to an account.';
