# Provider ingestion on VPS — 2026-10-21

Owner: all Gexbot, QuantData and Rithmic APIs must enter the VPS before the
website. This is separate from moving Next hosting or the account database.

## Completed source/runtime changes

- Found three direct-provider website helpers. `gexBot.server.ts` now delegates
  both legacy reads and signed history acquisition to the private VPS relay.
  Flow/VIX helpers unwrap the existing native-positioning gateway envelope;
  provider values and source timestamps remain unchanged. No browser keys.
- `gexbot-relay.mjs` is a private bearer-only read boundary on8795, routed by
  existing Caddy. Native requests delegate to gateway8793 rather than creating
  another provider/cache or Rithmic login. Legacy requests preserve their real
  primary origin and category/history semantics. No source substitution.
- Fixed vendor and archive hosts, explicit selection/date limits, no redirect
  following, no provider bearer on signed-storage downloads. Four concurrent
  distinct jobs, coalescing,64-entry/16MiB cache,8/16MiB response limits, request
  deadlines,30s429 hold. Sidecar512MiB/.75CPU bounded on existing VPS.
- Archive changed accepted Gexbot raw frames under a separate gexbot directory
  on the existing mounted recording filesystem, with awaited shutdown/flush.
  Native envelope cache ages are excluded from the raw observation hash.
  Binary gzip histories have explicit lossless base64 encoding in the archive.
- New service started/reloaded Caddy without restarting the Rithmic collector.
  Secret env is0600, only existing Gexbot key and private gateway token.
- Vercel Production conventional vendor key entries removed after confirming
  both providers authenticate on VPS. Existing dev/preview targets preserved.

## Verification

- `npm test` in gateway:455 passed, including6 relay tests.
- `node --import ./scripts/alias-hook.mjs --test tests/gexbot-vps-routing.test.mjs tests/gexbot-flow.test.mjs tests/market-data-gateway-env.test.mjs`:23 passed.
- Scoped ESLint and `npx tsc --noEmit --pretty false`:pass.
- `npm run build`:pass,84 generated pages.
- Actual VPS TLS reads: native auth/Classic/State/Orderflow200; legacy SPX200;
  QuantData QQQ Gamma1m map200,3,323,373bytes. Native options timestamps reflect
  the actual Oct20 close; do not label this a live RTH cadence test.
- Rithmic connected/authenticated, timestamps advance, recorder enabled and
  no reported recorder drops. Gexbot capture count4 after controlled probes,
  archive enabled/no error/no drops. Private full receipt:
  `%LOCALAPPDATA%/KwantDesk/vps-migration-20261021/provider-ingestion-verification.json`.

## Remaining boundaries

- Request-driven recording is not an always-on all-ticker/all-tool collector.
  Provider supported streams, quotas, entitlements and full recorded-session
  replay remain separate acceptance gates. Missing old depth is not recreated.
- Older sealed archives are still copying; originals preserved. No independent
  restore/boot drill or100-user soak proof. Finite included disk, no new purchase.
- Website hosting/auth/account DB remain existing Vercel/Supabase services.
  Authenticated Next relay remains; direct-browser feature flag stays false.
  This change does not claim zero Vercel charges or move the whole application.
- Preserve unrelated dirty native/social/document work. Do not stage ALGO.

## Release

One scoped main-only push after the local checks. Production READY/commit/API
acceptance must be recorded before calling the website routing live.
