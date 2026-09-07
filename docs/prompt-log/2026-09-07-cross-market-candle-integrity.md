# Cross-market candle integrity audit — 2026-09-07

## Prompt

Double-check every futures and options candle. Wicks must represent the exact
traded high/low, opens and closes must be accurate, the next candle must begin
correctly, and unexplained gaps must not appear.

## Diagnosis

1. The browser and VPS gateway disagreed on `Vol Bars` (`4/2VB`). The browser
   used target/reversal construction while the gateway routed the same interval
   through generic range-bar logic. Identical executions therefore produced
   different candles.
2. When cash/options history arrived after live snapshots, the history seam
   replayed only the latest price. A high or low observed earlier in the live
   bucket could disappear, creating a false wick or edge discontinuity.
3. Provider parsing accepted an OHLC row whose high was below the candle body or
   whose low was above it. Later display normalization could make that corrupt
   row look valid by manufacturing the missing extremum.

## Fix

- Ported the target/reversal Vol Bars algorithm to the gateway and made the
  `volume-bars` interval dispatch explicit.
- Added a shared historical/live-series merge. The startup bucket combines the
  authoritative history open with all observed extrema and the newest live
  close; subsequent fully observed live buckets retain their actual open/high/
  low/close.
- Recorded the first accepted cash/options live timestamp and reconcile the
  complete live tail when delayed history lands.
- Reject non-finite, non-positive and structurally impossible provider OHLC at
  every QuantData, Massive and Cboe history boundary.
- Added regressions for disappearing live wicks, real opening gaps, provider
  corruption, route coverage, event ownership and browser/gateway parity.

## Outcome and evidence

- Rithmic integrity matrix: 53 instruments × 50 intervals = 2,650 passed.
- Options/cash history routing: 14 symbols × 14 intervals = 196 passed.
- Gateway archive, History Plant, rollover, event ownership and provider tests:
  51 passed.
- Candlestick and event-continuity tests: 8 passed.
- Live authority 19/19; live visual path 13/13; OHLC heal 7/7; candle gaps 7/7;
  gap fill 5/5.
- Scoped ESLint: zero errors. TypeScript and the production Next.js build pass.

This does not force each time candle to open at the preceding close. A genuine
session or first-trade gap is market information and must remain visible. The
remaining active-market packet/coverage soak is tracked in IMPORTANT-NOTES.
