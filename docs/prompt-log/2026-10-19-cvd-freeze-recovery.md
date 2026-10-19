# CVD frozen/flat indicator recovery — 2026-10-19

Owner reports intermittent CVD freezing, flattening and stopping. Investigated
the existing candle sampler, execution source, engine and pane continuity cache.
No new credential session, gateway restart or native automation was performed.

## Reproduced failures (before edits)

Five of six initial targeted regressions failed on existing code:

- A1000-point retained plot rejected a newer80-point live snapshot repeatedly
  because the anti-regression guard required95% of the previous point count.
  A rolling/recovered window might never reach that old size: persistent freeze.
- Same-bar updated delta/high/low could be rejected for that same count reason.
- Rolling history eviction at the same endpoint was mistaken for regression.
- Engine preferred stale deltaClose=0 over actual Ask100/Bid900. CVD stayed
  at600 instead of advancing to-200 on that candle's-800 classified delta.
- Aggregate-trade mode admitted volume-backed candles with missing counts,
  silently replacing the missing data with0/0 and drawing a fake flat series.

The display cache was also scoped only by pane key/coordinate scope, allowing
old data to cover a newly chosen reset period/input/filter. Parent scope used
the live pane ID (unchanged during symbol/timeframe switches), not explicit
instrument/timeframe/contract. Those identities are now included. Exact owner-side
runtime attribution has NOT been established; these are reproduced code paths
consistent with the report, not a claim that every freeze has one sole cause.

## Changes

- Prioritize verified forward time/rolling-start/same-bar OHLC/value progress
  over historical shape/count retention. Still reject genuinely older/empty
  snapshots. Preserve engine-provided segment breaks, no false curve stitching.
- Match pane cache to sorted settings plus indicator identity and explicit
  instrument/timeframe/contract/replay scope; prune removed indicators.
  Theme/format/layout/account behaviour otherwise unchanged.
- Derive cumulative delta from the selected input's canonical Ask-Bid totals.
  Preserve genuine intrabar delta extrema and existing filters/session resets.
- Counts mode requires actual classified side counts and skips unknown bars
  with a break on recovery. Do not substitute contracts/share volume for counts.
- Existing proven history remains explicitly SYNCING if execution data is
  absent; a verified CVD tail behind a traded chart bar says WAITING FOR
  EXECUTIONS. No fake zero extension, new polling, stream or restart loop.

## Verification

- Nine new regressions; the actual pane-cache reconciliation is extracted,
  transpiled and executed with deterministic ref/prop adapters. This verifies
  its actual code rather than a copied approximation, not a mounted browser.
-31 CVD tests pass: freeze recovery, render continuity, live flow, session
  sampling, event flow authority, hydration and price scale.
-24 adjacent regressions pass: Big Blocks lifecycle, new-candle rendering,
  execution receipts and Liquidity Map CVD reconnect/session continuity.
- CVD settings10/10 and candle direction5/5 scripts pass, including exact
 5000-bar aggressive-flow cumulative totals with no internal gaps/stalled tail.
- Scoped ESLint passes for ChartIndicatorPanes, chartIndicatorEngine,
  cvdRenderContinuity and the new tests. Full Chart.tsx lint is not rerun after
  the prior task's documented4GB heap failure; its small status-copy additions
  are included in the full TypeScript/production build.
- Local84-page production build passes. Final event-chart status alignment
  and explicit instrument/timeframe/contract scope additions also pass the
  subsequent complete incremental TypeScript check; focused tests/lint rerun.
  Production build/runtime identity will be appended after verification.

## Still open

Signed-in owner session/live market-open soak, vendor feed continuity, complete
historical coverage, weekly completeness, Footprint and exact Deep Charts
numerical/live parity. This fix does not make absent provider data available.
Genuinely balanced executed flow and explicit filters can legitimately be flat;
do not add artificial movement to make CVD look active.
