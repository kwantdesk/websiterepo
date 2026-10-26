# Candle rollover redraw

Owner reports the chart/drawings flash when a candle closes and the next opens.

The Chart data effect treated a final change to the previous tail, delivered in
the same React batch as the new candle, as a historical correction. That chose
setData and unconditionally incremented the drawing timeline revision. The SVG
layer then hid its obsolete geometry until its next React commit. Small charts
could also repeat the initial fit/loading mask on these redraws.

Changes:
- Compare the closed prefix independently of the previous forming tail. Finalize
  that tail and append its successor through series.update, using the installed
  historical-update flag if the direct stream already appended the new candle.
- Continue replacing history for older corrections, skipped bars, replay rewind
  and style transitions. Only invalidate drawing projection on interior time-map
  changes (or event-bar replacement), rather than OHLC-only corrections.
- Reserve the small-chart initial fit condition for the initial draw.

Validation:
- 17 candle integrity tests pass, including executing the actual Chart effect
  against a recording series for both ordinary and already-appended rollovers.
  Tests assert final OHLC, update order, no setData/loading or drawing revision.
- 38 drawing, break-even, timeframe and viewport regression tests pass.
- Live candle authority script passes 19 intervals; visual path script 13 checks.
- Production build passes. Scoped helper/test ESLint and diff whitespace checks
  pass. Chart monolith is covered by production build and extracted-effect tests.
- No gateway changes, feed restart, added polling, archive rewrites or invented
  candles. This addresses a reproducible rendering path, not the separate open
  investigation into missing/incorrect historical source data. Owner-session
  visual acceptance was not performed; no trades/drawings were changed.

Release through the existing single main-only production Git integration.
