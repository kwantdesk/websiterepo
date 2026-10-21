# GEX Data unavailable after VPS provider migration

Owner reports selected market data cannot load on the actual GEX Data page.

## Root causes and scoped repair

1. Every successful provider response with19 remaining/reset55 forced ~2.9s
   shared pacing. Multi-tool workspaces exceeded route deadlines despite fast
   provider reads. Restrict proactive header pacing to below10 remaining, per
   https://quantdata.us/api/docs/rate-limiting. Keep180/min reserve,350ms minimum
   spacing, concurrency2 and real429/zero-token backoff.
2. A response-size failure502 incorrectly poisoned the entire vendor-origin
   breaker. Fixed allow-listed gateway request-error header preserves the real
   error while isolating it from unrelated healthy tool requests.

Do not raise the12MB response ceiling, fake data, remove authentication or
increase paid services. Existing workspace reads returned200 individually:
QQQ exposure144874B/264ms; NDX map682014B/140ms; NDX history41162B/66ms;
QQQ drift97218B/56ms; NDX drift75931B/55ms; prints26974B/40ms.

## Verification before release

- Full gateway suite457/457; website request/provider isolation3/3.
- Scoped ESLint, TypeScript and production build84 pages pass.
- Deployment uses only two read-only runtime module mounts on current clean
  VPS image; do not ship unrelated dirty source. Gateway-only graceful recreate.
- Actual deployed browser acceptance is required, not inferred from API200.
- Old-history upload paused during incident; sealed source archive preserved.

Runtime and browser acceptance receipt follows after rollout.
