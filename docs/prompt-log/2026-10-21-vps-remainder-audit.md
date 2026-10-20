# VPS migration remainder audit — 21 October 2026

Owner: “make sure nothing is left over, everything goes over.”

## Acceptance inventory (do not mark the entire migration done prematurely)

| Component | Current owner / acceptance |
| --- | --- |
| Single licensed futures collector | VPS, authenticated and recording; laptop owner stopped |
| Raw L3, bars, compact trade/flow/profile stores | VPS live writes; essential/final delta verified; older16GiB checksum transfer still running |
| Current options observation archive | Final laptop gzip members verified and merged before VPS members, originals preserved |
| Older closed options observations | Part of pending verified bulk restore; never overwrite current append files |
| Futures quotes/trades, cash-index and liquidity SSE | New bounded direct-VPS edge tested; website activation/runtime acceptance pending |
| Website SSR/API/static hosting | Still Vercel; full VPS web-host preparation/DNS cutover must be explicit and verified |
| GEX DATA vendor acquisition | VPS coalesced vendor edge; interval-map response-size failures remain under investigation |
| KWANTY native positioning | VPS status/Classic snapshot200; stream/history entitlement and all-overlay parity remain separate gates |
| Legacy GEX server vendor requests | Inventory and route migration required; not all use the new positioning edge |
| Options always-on capture / session replay | Observation capture is not complete exchange/session capture; existing poller disabled to protect quota |
| Identity/account persistence | Existing Supabase; do not casually replace auth/database or copy unverified tables |
| Macroeconomic scheduled ingestion | Existing Vercel cron; migrate scheduler only after equivalent authenticated VPS worker works |
| Recovery/monitoring | VPS restart policies, mount dependency, bounded logs and health/capacity watchdog installed; full reboot/independent restore unverified |
| Laptop bridge and old transports | Compatibility only, NOT the collector; retire after open old deployments no longer need them |

## Direct streaming security contract

- Existing site-access middleware authenticates original same-origin API GET.
- Feature flag `KWANTDESK_BROWSER_STREAM_DIRECT=true` returns a non-cacheable307
  to the verified feed TLS origin. No new unauthenticated signing endpoint.
- HMAC ticket lasts300s and binds audience, version, website Origin, exact
  upstream path and exact query. Only quotes, executions, index and heatmap SSE
  are allowed. No account, order, arbitrary REST, provider origin or raw key.
- New read-only sidecar holds only the existing gateway bearer, not vendor keys.
  Private Docker port8794,256MiB/.5CPU budget,512 maximum streams; Node piping
  preserves framing/backpressure. Header deadline15s; lease expiry closes socket.
- Origin CORS is exact www/apex website only, without credential cookies. Invalid,
  altered, expired, future and wrong-scope tickets fail closed. Direct mode never
  silently falls back to long-lived Vercel streaming.
- Caddy omits the signed stream URL from access logs using documented `log_skip`:
  https://caddyserver.com/docs/caddyfile/directives/log
- VPS edge deployed separately; collector was NOT restarted for this change.
- Local interoperability/security/HTTP passthrough tests pass5/5. Actual TLS edge
  returned200/raw SSE on all four paths, first data660–746ms in this probe.
  These are transport probes, not browser reconnection/paint/soak proof.

## Remaining verification

Record exact production SHA/build, authenticated browser delivery, lease expiry
reconnect and invalid-lease denial; no secret values or signed URLs in receipts.
Preserve original recordings, old verified releases and DNS rollback until final
acceptance. Do not cancel paid subscriptions, create new storage or delete source
history as a shortcut.

## Runtime acceptance and safe rollback

- Main c8898fc7 built READY, but the in-app browser refused a direct navigation
  to https://feed.kwantdesk.com/health (ERR_CONNECTION_REFUSED). No browser
  stream reached the sidecar. Server probes alone did not establish browser
  connectivity. Browser DNS-cache control is not available under the tool's
  browser security policy; do not attempt a workaround or weaken TLS/CORS.
- Rolled production back immediately to the verified82691d1c deployment; the
  collector remained live on VPS. Direct-stream flag is now false for subsequent
  builds. Existing authenticated Vercel body proxy remains a cost/open migration
  gate, not an accepted final architecture. Do not enable direct mode again
  until actual browser TLS reachability, stream and reconnect checks pass.
- Full website transfer has real external-access gates: Squarespace is signed
  out in the connected Chrome profile. Vercel env pull redacts31 sensitive
  entries; checked local project env files lack site-access password, Supabase
  service key and desktop signing/revocation credentials. Some provider keys
  exist separately, but that is not a complete authenticated app configuration.
  Never deploy placeholder [SENSITIVE] values, bypass auth or reset credentials.
- Existing Vultr automatic backups were verified enabled but WEEKLY, with no
  completed image. Changed that existing service to DAILY09:00UTC and verified
  update/next backup2026-10-21T09:00Z. No new service/volume/snapshot purchased.
  This is not proof of a completed backup or restore drill. Official service
  schedule/pricing: https://docs.vultr.com/product-overviews/backups.
- Backed up and disabled stale Windows task Kwantify Sierra Market Gateway;
  it referenced missing Desktop/olisa-labs-platform startup script. Original
  local recordings, Rithmic STOP marker and current compatibility bridge remain.
- Bulk transfer was paused briefly after saturating the laptop uplink delayed
  management connections. Resume at verified prefix with512KiB/s pacing,
 64KiB buffers. Verified-only closed-session restorer remains in place.
- Direct provider size probes returned200 for QQQ/SPX/SPY/NDX1m Gamma maps:
  3.32MB/4.74MB/3.53MB/0.68MB. These did NOT reproduce the12MB ceiling fault;
  do not raise/remove memory limits blindly or claim all tools repaired.
