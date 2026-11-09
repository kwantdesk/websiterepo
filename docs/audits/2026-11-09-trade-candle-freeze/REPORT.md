# Candle stalls while price continues ticking — 9 November 2026

## Confirmed defect and repair
The quote/mark path and exact-execution candle path are separate. Planned execution-stream renewal previously closed the working EventSource before fetching its replacement authenticated lease. Slow authentication therefore stopped candle/CVD/delta input while quote marks could continue. Authentication timeout and reconnect backoff could prolong this interruption.

The engine now requests replacement access 10 seconds before expiry while keeping its existing stream connected. A successful lease is handed directly to reconnect without another authentication request. Failed renewal retries without closing the healthy stream. Generation checks discard renewal responses after stop or a transport recovery. Existing reconnect seed deduplication, continuity checks, per-execution paper protection, and admitted-print flushing remain in place. The subsequent SSE connection/seed handoff is still a brief reconnection, not a guarantee of zero network latency.

## Evidence and checks
- The delayed-lease regression test fails against the previous engine and passes against the repair (negative-control log attached).
- 32 focused tests pass: delayed/failed/cancelled renewal, renewal deduplication, freshness recovery, and exact paper-order protection.
- Scoped ESLint passes for executionTapeEngine.ts.
- Full isolated Next.js production webpack build passes, including TypeScript and route generation.
- An isolated headless browser ran the real Chart renderer and actual paper market-order/position code. Chart construction remained at one; successful candle series updates advanced from 81 before entry to 181 after entry, with no rendering errors. This did not reproduce the owner's exact trading-session freeze; it rules out an unconditional chart stop merely from adding a paper position in that controlled fixture.
- Read-only 10-second shared VPS execution streams returned HTTP 200: NQ 23 new execution records, ES 29. Largest observed event gaps were approximately 3.84 seconds and 1.87 seconds respectively. This was a short, thin-session observation and does not establish the owner's browser health or peak-session responsiveness. No synthetic prints or wicks were added.

## Scope and remaining limits
This is a verified repair of the renewal interruption, not proof that every reported freeze has the same cause. Trade entry itself was not established as the causal trigger. No gateway, terminal or provider subscription was restarted; no owner browser tab, order, account or workspace was changed. Frontend code reaches existing sessions on their next normal reload.

The release changes only the execution tape engine and its regression tests. Production release verification is recorded separately after the single scoped main push.
