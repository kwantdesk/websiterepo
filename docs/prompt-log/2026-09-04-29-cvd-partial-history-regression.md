# Prompt 29 — CVD stuck restoring after deeper candle history

## Requested

Fix Cumulative Volume Delta after it regressed from a mostly working pane to a
blank study stuck on “Restoring cumulative volume delta history.” Preserve the
correct session-gap behavior and do not manufacture order flow.

## Diagnosed

The CVD calculation itself was not empty. The chart added a 95% coverage gate
that hid every calculated CVD series until almost every visible traded candle
contained aggressor-side bid/ask volume. Rithmic price-bar history can extend
farther back than the locally recorded execution archive, so the gate could be
impossible to satisfy and the pane remained blank indefinitely.

## Fixed

- CVD, cumulative delta candlesticks/histogram and Delta Bar now render any
  verified execution-backed segment immediately instead of being hidden by the
  whole-window coverage threshold.
- OHLCV-only candles are still excluded. No historical delta is inferred or
  fabricated from price bars.
- A missing aggressor-side candle creates a hard break and resets the next CVD
  segment, so the renderer cannot draw a false line or carry an unknown running
  total across the gap.
- The existing session-boundary preservation remains active through normal,
  sampled and side-docked CVD rendering.
- While older executions are genuinely incomplete, the status says “Partial
  execution history” rather than claiming the visible verified segment is not
  available.

## Outcome

The blank-forever regression is removed without weakening data integrity. CVD
shows the execution history the platform actually possesses, keeps unknown
regions visibly disconnected, and continues updating as verified Rithmic
executions arrive.

Focused hydration, session-sampling, settings, candle-direction and missing-flow
regressions pass. TypeScript and production build results are recorded with the
deployment commit.
