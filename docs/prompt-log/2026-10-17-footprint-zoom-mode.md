# Footprint briefly becomes native candles when zooming out

Owner reports that zoom-out switches Footprint to normal candlesticks and back.

The chart's presentation effect gated both native-candle transparency and
Footprint primitive updates on at least 85% price-level coverage. A wider zoom
window introduces bars before their exact history arrives, lowering coverage;
the effect then restored native candle colours and cleared Footprint data.

Changed presentation ownership to the selected Footprint indicator rather than
coverage. Known rows and actual OHLC geometry continue rendering while history
loads. Imperative row retention is scoped by instrument/timeframe/contract.
Native series remains attached/transparent, preserving price autoscale and all
attached overlays. Initial creation also uses transparent candle colours when
Footprint is already selected. Turning Footprint off restores normal colours.

All Footprint test files pass: 55 tests, including mode-ownership/first-paint
regressions, existing live-row continuity, exact-history, settings and renderer
checks. Source data/calculations, saved settings and provider configuration are
unchanged. No authenticated UI zoom/market-session soak is claimed. Permanent
history coverage, provider recording access and existing broad indicator test
failures remain on the important-notes ledger.
