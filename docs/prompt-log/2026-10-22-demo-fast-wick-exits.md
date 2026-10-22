# Demo fast-wick TP/SL exits — 2026-10-22

Request: fast touches sometimes fail to exit demo positions; use the exact configured tick even on a brief wick.

## Diagnosis and repair

- Quote batching preserves the last price, not every execution. Reproduced: [24001, 24010, 24000] in one millisecond leaves a 24010 target open with the sampled quote; ordered actual prints close it at 24010.
- Added a pure execution-tape adapter and workspace-owned shared contract subscriptions. Display-only futures quotes cannot advance protective execution time ahead of the exact trade tape. Open exposures stay subscribed without their chart selected; unrelated selection changes do not reconnect them. Historical initial seeds cannot execute new orders.
- Flush already-admitted executions before reconnect rather than losing a queued print that subsequent dedup would suppress.
- Reject pre-creation executions for resting entries. Keep exact stored stop/target tick prices, partial quantities, arrival-order first-hit behavior, replay-clock isolation and intentional drag suspension.
- Fix an independent race: asynchronous cached-bar reconciliation could write an old ledger over a live TP/SL exit. Load history first, then apply to the latest ledger synchronously.

## Verification

- 14 focused tape tests + 3 continuity tests; long/short one-print wicks, identical millisecond timestamps, exact quarter ticks, both TP/SL arrival orders, partial targets then stop, dedup/no double exit, stale/invalid/summary/wrong-symbol rejection, display/tape race, suspended drag, queued-print reconnect, shared subscription and async-ledger guards.
- Existing 8 protection trigger and 8 limit-fill cases; existing limit-order ticket/engine/chart and stream-staleness scripts pass.
- Existing legacy source integration suite: 16/21 both before and after; the same five stale UI/source-regex assertions fail on unchanged HEAD. No new integration failure.
- Bounded read-only production NQZ6 SSE probe: HTTP 200, sequence-zero continuous seed and sequential continuous trade batches 1–4. No gateway restart or user trade was used.
- Local 10,000-print processing benchmark ~46ms, with no per-print React update. Shared worker batching unchanged at 40ms; no new provider login, services or polling.
- Final local production build passed TypeScript and all 84 static pages; scoped ESLint has no errors. Journal bridge/link (19) and trade export (12) regression checks also pass.

## Boundary

This is browser demo execution while the live stream is available, not server-side broker execution or a guarantee during disconnected/closed-browser periods. Historical seeds/OHLC are not fabricated into protective intrabar paths. No demo account, balance or existing trade was reset/placed/edited during testing.
