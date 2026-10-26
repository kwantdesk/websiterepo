# Candle body/wick source and rollover repair

The owner reported live candle bodies subsequently shifting, wicks disappearing
and incorrect gaps. No owner trades, accounts, positions or protection prices
were changed in this investigation.

## Reproduced causes

1. The browser startup OHLC cache accepted book midpoint, unspecified and cached
   quote packets as execution prices. A regression produced a fake999wick from
   those packets before the fix.
2. Plain CME charts did not require the full execution stream. Gateway quote
   fan-out batches retain the last trade and aggregate quantities, omitting the
   first trade and intervening price extrema. Later execution history therefore
   disagreed with the initially displayed geometry.
3. The closing-bar renderer used an array prepared before later direct candle
   events. Its rollover update replaced a112/95wick and108close with stale
   103/99extrema and102close in a test of the actual TSX expression.
4. Same-bucket delayed executions rewound the current close despite a newer
   print already having arrived. Source-end watermarks now protect that close.

All CME panes now use the existing contract-shared execution subscriber. Quote
SSE remains available for marks/BBO but does not write their candles. Startup
cache writes occur once per shared execution publication, before pane fan-out.
Old browser time-v4 data is excluded by time-v5. Closing paints reconcile the
latest observed buffer immediately before updating the series. Historical
corrections are not globally disabled and genuine gaps are not filled artificially.

## Verification

- Three initial regression tests failed against the preceding code and passed
  after the fixes (cache contamination, stale closing paint, delayed close).
-77 tests pass across candle source authority/repaint/durable restore, stream
  continuity, event bars, live execution tape and paper order/protection paths.
- The real gateway recording for NQZ6 at2026-10-26T22:00–22:02UTC supplies349
  individual executions in the committed fixture. The production candle
  builder reproduces archive OHLCV with batch sizes1,2,7,32,120and349.
  The archive's actual2.75point boundary gap remains; forcing a previous-close
  open would fabricate a market price.
- Two pane subscribers use one worker and record volume once. No duplicate
  cache volume is introduced by sibling charts.
- A bounded12second read-only gateway SSE probe returned HTTP200,128seed
  executions,124incremental executions and a stream receipt identifier.
- Production Next.js build and scoped ESLint pass. An existing legacy tape
  test's handwritten TypeScript stripping failed on a generic function before
  assertions could run; it now imports the real module through the existing
  Node alias hook, and its four tape tests pass.

No VPS restart or market-data provider reconfiguration was performed. Existing
browser tabs must refresh to run the deployed frontend and replace old caches.
This receipt does not claim every older archive contains complete raw prints
or that every visible chart was watched through an entire market session.

## Reference behaviour checked

TradingView's datafeed documentation says a live same-time update replaces the
whole bar and a later time appends a bar; historical replacement is a separate
operation. Thus every update must supply accumulated true OHLC, rather than a
single last quote or stale React snapshot:

- https://www.tradingview.com/charting-library-docs/latest/connecting_data/Datafeed-API/
- https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/required-methods/

