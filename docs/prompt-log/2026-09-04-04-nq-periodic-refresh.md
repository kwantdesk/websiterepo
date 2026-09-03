# NQ periodic chart refresh

Date: 2026-09-04

## Prompt

> why does my nq chart keep refreshing all the time now fix this

## Diagnosis

The chart had two valid direct live-paint paths: accepted Rithmic prices and
exact Rithmic executions. Despite those direct updates, each path also pushed
the entire candle-history array back through React every two seconds. That
duplicated the paint, re-ran dependent chart work and appeared as a periodic
whole-chart refresh.

## Fix and outcome

- Removed both two-second full-history commits from Rithmic live handling.
- Forming candles continue painting directly on each accepted frame.
- Footprint executions continue reaching the canvas at the 40 ms foreground
  cadence.
- Full React history now changes only at a genuine bar boundary, preserving
  completed history without periodically disturbing the visible chart.
- Added a source regression that prohibits the two-second reconciliation loop
  and requires both live paths to commit only on `newBar`.

## Verification

- Live routing regression passed, including the new prohibition on periodic
  Rithmic full-history commits.
- Rithmic 53-instrument x 50-interval matrix passed (2,650 combinations).
- Candle gaps 7/7, gap fill 5/5, Footprint bar window 6/6, execution-worker
  backpressure and live-chart memory guard passed.
- TypeScript and the complete 80-page production build passed.
