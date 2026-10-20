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
