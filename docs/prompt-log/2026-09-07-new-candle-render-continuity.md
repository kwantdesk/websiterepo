# New-candle render continuity

## User prompt

> bug  when a new cae opens, the whole page glitches, my short calculator indicators wtc flash away and then come back like abig???

## Diagnosis

The direct live-candle event already updated Lightweight Charts without React,
but the workspace also committed the complete candle history synchronously at
every new bucket. Inside `Chart`, any array-length change was classified as a
historical shape change. A routine one-candle append therefore bypassed the
bounded live sampler and immediately recalculated every enabled indicator.

On an indicator-heavy chart that concentrated the largest React and study
engine workload into the exact frame where the next candle opened. The chart
was not losing saved calculators or indicators; the main thread was blocked
long enough for the canvas/primitive layers to miss paints and visibly flash
away before catching up.

## Fix

- Added an explicit classifier for a genuine one-bucket live append.
- Kept authoritative history hydration, corrections, backfills, replay and
  execution-archive restoration on the immediate path.
- Routed routine bar-boundary indicator snapshots through the existing bounded
  low-priority sampler.
- Changed every live time-bar structural commit (Rithmic execution path,
  Databento quote path and cash/options quote path) to `startTransition`.
- Preserved the direct live chart event, so the new candle and its price still
  paint immediately rather than waiting for React or indicator calculations.

## Outcome

Opening a new candle no longer asks the browser to synchronously rebuild the
whole indicator stack. Calculator drawings and indicator panes remain mounted,
the price candle continues immediately, and heavier studies reconcile just
afterward without blocking the visible chart.

Regression coverage distinguishes a live one-bar append from backfills and
corrections, and verifies that all live structural commits are interruptible.

