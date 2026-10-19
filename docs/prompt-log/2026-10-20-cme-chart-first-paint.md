# CME chart first paint — 2026-10-20

## Request

Owner reports roughly30s NQ 1m/3m startup and supplies a screenshot with both
panels on Loading chart. Work unattended; defer questions instead of stalling.
Preserve accuracy, cost controls and the wait-for-Vultr infrastructure decision.

## Evidence and cause

- Gateway healthy, authenticated and not currently event-loop overloaded.
- Same ten-day NQ 1m history:8,059 bars,71ms local and1,068ms via public relay.
  No provider request or gateway restart needed for those archived reads.
- Actual candle and timed-flow adapters still used completedHistoricalEnd:
  floor((now-60s)/60s). Gateway history has an EXCLUSIVE upper bound, so that
  cut the active and last closed minute. Its real archive loader already merges
  the in-memory forming edge. The frontend rightly rejected this artificial
  gap and waited for another snapshot/reconciliation before settling startup.
- Live local comparison: old1m cutoff required reconciliation, current gateway
  edge passed. A3m result depends on which minute of that bucket is current;
  first-minute fixture reproduces the same failure. Later minutes lose current
  OHLCV even when the timestamp alone happens to pass.
- A second branch only ran fast base OHLC when cachedBase was EMPTY. Returning
  charts with stale or unenriched cached candles therefore waited for heavy
  flow history despite the prior independent-cold-history fix.
- Fresh signed-in production /charts probe reproduced Loaded8,065candles under
  the full Loading chart cover with10 saved indicators. It eventually settled;
  temporary probe tab was closed to stop its ongoing data traffic. A daily
  profile still reported missing history: this repair does not invent that tape.

## Repair

- Preserve requested recorded-history end for candles and flow; do not apply
  retired vendor availability lag to our own live recorder. Replay keeps exact
  exclusive bounds. Gateway remains the source of all OHLCV; no fabricated bars.
- Start early OHLC unless immediate cache is fresh, sufficiently deep, current
  and flow-ready; consume it for stale/un-enriched caches too. Fresh verified
  cache remains request-free; real holes still require reconciliation.
- Timed-flow durable key v6 avoids clipped cached results. CME browser reads
  privately revalidate ETags instead of no-store; forced refresh uses reload.
- No source feed cadence, indicator calculations, worker geometry, subscriptions,
  credentials, collector process, recordings or hosting service changed.

## Verification

-20 focused tests pass: actual adapters/live-edge/replay, initial concurrency,
  cache hydration, loader identity and CVD enrichment continuity. Source/test
  ESLint passes; workspace lint has zero errors (existing large-file note).
- Candle integrity:53 instruments ×50 intervals =2,650 combinations pass.
- Broader interval-routing script stops on pre-existing source-count assertion:
  expects5 Chart venue subscribers, baseline HEAD already has7. Chart.tsx is
  unchanged by this task; do not rewrite unrelated production logic to pass it.
- Final local production build passed (TypeScript and84generated pages).
  Production receipt appended after completion. No universal
  near-instant loading or signed-in30s-to-specific-time claim without measurement.

## Still open

Supported permanent streaming transport (temporary Quick Tunnel SSE limitation),
month futures/options capture/backfill, missing Asia executions, weekly/footprint/
CVD live soak, GEX parity/cadence and multi-user shared acquisition/cost gates.
