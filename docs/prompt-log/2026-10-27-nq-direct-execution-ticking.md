# NQ execution delivery and responsiveness — 2026-10-27

Owner reports NQ pausing and jumping instead of ticking responsively.

## Evidence and change

- Existing worker fanout was already 8ms and visible pane folding already next RAF. Changing those again would not establish the cause.
- Twenty-second paired VPS probes: internal and public TLS edge each delivered 24 actual NQ executions. Median source age 14ms, p95 34/35ms. Actual execution interarrival gaps reached 4.676s in this quiet sample; these are observed source gaps, not an excuse to synthesize price changes. This does not benchmark New York capacity.
- Production execution EventSource still held a continuous Vercel body proxy. Old direct rollout was disabled after browser DNS/connection refusal on Oct21. Actual in-app-browser https://feed.kwantdesk.com/health now succeeded with live connected/authenticated provider, confirming that blocker cleared.
- New client explicitly negotiates a finite exact-request five-minute HMAC URL over the same site-access-protected market API, then opens EventSource directly at the VPS. Gateway signing key stays private. Exact root/contract/venue, source timestamps, continuity receipt and lossless worker/RAF path are retained. Legacy clients, quote streams, index and heatmap routes retain their existing behavior; global legacy redirect flag remains off. No CORS relaxation, null-Origin acceptance, extra vendor session, VPS restart or new service.
- Planned lease renewal uses zero reconnect backoff, not the four-second outage backoff. Initial seed remains128; reconnect seed4096 is deduplicated into the same tape, never replayed as a second initial seed. Actual outage backoff/watchdog preserved. No hidden paid-stream fallback in the new execution client.
- Opt-in charts?feedAudit=1 stores bounded DOM diagnostics (512 samples per instrument), source-to-series-update age and long tasks. Measurement occurs after series.update; it does not establish pixel presentation latency. Ordinary charts skip diagnostic work. No account/trade contents captured.

## Validation

99 focused tests pass, including exact lease scope/origin/expiry, client destination validation, planned reconnect and dedup, worker cadence/backpressure, historical wicks, futures identity, footprint handoff, continuity and exact paper execution protections. Existing staleness script passes. Scoped ESLint passes. Production build and live browser acceptance recorded below after completion.

Browser-stream edge before deployment: active0, accepted4, denied0. Receipt is local; no bearer/ticket URL saved in it.
