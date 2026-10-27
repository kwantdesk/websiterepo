# Actual trade entry arrows

The owner requested a small red arrow marking where an entered trade actually
filled, alongside the existing position line.

The chart already had a fill primitive, but buy entries were green, the triangle
tip pointed six pixels beyond the fill's candle coordinate, and marker hydration
did not depend on chart creation. Event-bar synthetic coordinates and missing
clock buckets also needed distinct treatment to avoid incorrect time anchors.

## Change

- Both buy and sell entry arrows are red (#ff3b5c). Their tip is exactly at the
  execution-price coordinate and the containing candle's coordinate. The small
  triangle extends left from that point. Existing exit markers retain their style.
- A pure marker builder consumes actual ledger fills. It preserves execution
  price rather than using candle close/live quote, filters by instrument, dedups
  fill IDs and waits for a real containing candle instead of guessing a marker
  in an absent or future clock bucket.
- Event bars use source-execution time and the chart's synthetic axis map.
  Clock charts ignore leftover event maps after a timeframe switch.
- The real marker effect re-runs after chart creation/recreation and merges
  direct observations so a newly printed candle can host its fill before the
  sampled React candle array catches up.
- No order engine, account balance, trading position or protection level changes.
  Working orders do not become fill arrows. Existing fill visibility controls
  and selected-account/ledger persistence are preserved.

## Verification

- 28 targeted marker/execution/receipt tests pass. New cases cover exact prices
  on 1m/3m, wrong instruments, invalid/unfilled data, missing/future buckets,
  direct live candles, event source times and synthetic coordinates.
- The actual TSX canvas renderer is executed with both buy and sell entries:
  the tip equals the fill's projected price/time coordinate and colour is red.
- The actual marker effect is tested before and after chart attachment; the
  chartReadyRevision dependency restores the markers.
- 13 existing entry/exit drawing geometry checks and the focused persistent
  fill integration check pass with the intentional automatic-arrow changes.
- Scoped ESLint and production build are checked before the main-only release.
  Tests use isolated records; no owner order was submitted to produce a marker.
