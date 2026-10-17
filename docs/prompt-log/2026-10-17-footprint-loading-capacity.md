# Footprint blank on ordinary chart load

## Request and reproduction

Owner reports a blank/non-loading Footprint and asks for indicators to work.
A real NQZ6 Oct16 13:30–16:10 UTC request returned HTTP422, 281,744 source
executions and no records because the browser raw-tape limit was 100,000.
A two-minute request returned 5,891 exact prints successfully. This was a
separate defect from missing weekly sessions.

## Repair

- Added a POST mode on the existing authenticated tape history route. Caller
  supplies ordered candle starts, end and per-print size filters. Source folds
  once in the serialized archive worker, outside the live event loop. Response
  contains exact bid/ask/unknown volumes and integer trade counts per price,
  full unfiltered candle OHLCV, and filtered delta high/low from actual order.
- Browser validates contract, boundaries, full OHLCV, totals and counts, then
  uses existing grouping, POC/value-area, imbalance, VWAP and rendering logic.
  Filtered summaries cannot be mistaken for individual big trades. Raw/event
  tape endpoints remain unchanged. Unknown aggressors remain unknown.
- A new summary generation now hydrates the full render cache immediately;
  previously only the last bar and a slow correction cursor repainted. Normal
  live appends stay incremental. Failed requests retain proven overlap rather
  than wiping all last-good records.
- Coalesced, source-fingerprinted cache: eight entries, 60 seconds, max eight
  outstanding compact jobs. Input/output bounds: 1,000 bars, ten days, five
  million source prints, 30,000 price levels. No per-tick provider calls or
  continuous Vercel streams added; calculations remain gateway-owned.

## Verification

- All Footprint test files: 53 tests passed. Compact-vs-raw parity covers print
  filters, volume/trades inputs, grouping, side counts, unknown volume, POC,
  value area, VWAP and actual delta extrema. Over-100k case preserves all prints.
- Complete gateway suite: 393 tests passed. Compact worker integration proves
  coalescing, exact counts and extrema above the old raw limit. Scoped lint and
  isolated production build passed.
- Public relay POST through actual browser decoder, Oct16 13:30–16:10 UTC:
  NQZ6 160 candles, 281,744 source prints, 31,121 compact side records,
  416,946 bytes, 1,355ms, exact validated volume 302,178.
  ESZ6 160 candles, 553,424 source prints, 4,958 compact side records,
  93,445 bytes, 934ms, exact validated volume 718,291.
- Scoped backend copied and gateway gracefully restarted with a single owner
  (PID29228), before frontend release. No unrelated native/ALGO changes staged.

## Broader checks / not fixed

Indicator sweep across CVD/profile/Footprint/execution tests: 143/153 passed.
Ten failures reproduced with pre-change Chart.tsx supplied to source-reading
tests: Daily Profile catalogue, seven daily/profile source-wiring expectations,
TPO engine test loading, and profile width-basis expectation. They are not
evidence of a clean whole-library audit and remain open for separate diagnosis.
No authenticated saved-workspace visual check or live-market soak was possible.
Missing weekly exact sessions/other roots, event/sub-minute recovery, memory
soak and permanent VPS migration remain unresolved.
