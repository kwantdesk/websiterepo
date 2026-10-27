# Closed-candle changes after the execution-source fix

The owner reported that historical candles still changed during trading after
8750a5c7. That release fixed quote ingestion and a closing paint race, but left
two additional overwrite paths active. This follow-up does not treat the prior
release's passing tests as proof that the reported behaviour had stopped.

## Reproduced paths

1. The four-minute background job fetched ordinary cached history and replaced
   existing closed OHLC merely because the bucket was older than two minutes.
   No per-bar completeness or exchange correction receipt was checked. It then
   dispatched the entire result as CLOSED_CHART_HISTORY_EVENT, bypassing the
   chart's normal observed-wick protection via acceptClosedHistory.
2. The CME execution subscriber writes latestCandlesRef synchronously and commits
   React history using startTransition. A later effect unconditionally assigned
   latestCandlesRef = candles. If newer trades arrived before that deferred
   render committed, the effect rolled ingestion back, losing prints and even
   a newly opened bucket from the next aggregation.

## Change

- Routine healing fills real missing closed buckets and reconciles flow fields.
  It does not replace already published candle OHLC or emit a verified-price
  correction event. Both healing entry points default to backfill-only.
- Deliberate, verified correction is still supported through an explicit policy;
  a routine cache response is not automatically promoted into that policy.
- The React mirror does not overwrite CME ingestion state. All CME/replay
  setters already assign the ref synchronously. Other adapters retain their
  existing React-driven fallback.
- No fake wicks, forced previous-close opens, generated no-trade bars or
  invented historical executions were added. A manual chart refresh continues
  to reload archive history; this does not assert all archive history is complete.

## Evidence

- Three new regressions failed before the changes: stale React state replacing
  ingestion; routine snapshots replacing closed price geometry; and a flow heal
  also changing OHLC.
- 81 targeted tests pass, including the actual TSX background heal across 20
  conflicting cache snapshots and the actual React mirror effect. Missing
  minutes still insert and flow still repairs while existing OHLC remains stable.
- Eight correction/backfill checks pass. Fixtures requesting an intentional
  price correction now opt into verified-correction explicitly.
- Fresh VPS raw recording: 1,285 NQZ6 executions covering five closed minute bars
  from 2026-10-27T00:12:00Z. Feeding those executions into the actual frontend
  candle builder exactly matches archived open, high, low, close and volume
  for all five minutes. This validates that bounded sample, not every session.
- Production Next.js build and scoped ESLint pass.
- No gateway restart, new provider subscription, owner order submission or
  modification of accounts/positions/TP/SL was performed.
