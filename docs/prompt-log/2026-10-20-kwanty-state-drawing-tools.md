# State chart tools — 2026-10-20

Request: a working normal-chart left tool rail in State, including fixed volume
profiles and drawn long/short P&L calculators, engineered for all State tickers.

## Implemented

- Reuse the site's drawing engine, grouped tool catalogue/icons, full drawing
  settings and lazy emoji picker rather than duplicate approximate tool maths.
- The same lazy host adapter is available in standalone KWANTY and chart-grid
  State panels. Price/time transforms adapt State milliseconds and conversion to
  normal seconds/raw-price drawing anchors. Data-driven candle time/price axes
  remain the sole coordinate source, never GEX exposure or strike-row indices.
- Save per-panel/per-ticker drawings in existing account workspace/template data;
  debounced edit saves, close/restore, pagehide flush, async mount disposal and
  old-ticker event isolation. Normal handle edits, magnet, text, settings, undo,
  redo, delete, clear and zoom remain functional.
- P&L uses actual observed current price independently of the next candle, in
  the underlying's price units (not an invented dollar/options-position P&L).
- Exact ES/NQ fixed/anchored range profiles use existing gateway acquisition,
  source contract resolution, filters, grouping and value-area controls.
  Requests debounce 300ms and run sequentially; no tick polling or extra feed.
  Inactive/no-price-geometry panes do not start profile requests, and changed
  range signatures cannot display old histograms.
- Preserve real reported bar volume in price history/aggregation for AVWAP;
  unknown volume stays unknown and missing ranges cannot generate fake VWAP.
- State profile/price rendering, colours and circles remain unchanged except
  for reserving a 36px rail and the panel header.

## Validation

- 232 KWANTY/reference tests pass, including new coordinate round trips for
  SPX/SPXW/SPY/NDX/QQQ/VIX/AAPL/ES_SPX/NQ_NDX, converted axes, invalid placement,
  source range windows, lifecycle/disposal, saved ticker isolation and truthful
  volume aggregation.
- TypeScript passes; scoped lint passes. Embedded host lint retains its existing
  ref-cleanup warning (no new lint errors).
- Shared normal-chart resize/migration/crosshair scripts: 9+7+7 checks pass.
- Existing test-custom-draw-volume-profile.mjs fails on its outdated exact
  source-string assertion for the unchanged indicator Add handler. HEAD already
  uses a conditional anchored-VWAP/fixed-profile tool; not introduced here.
- Isolated actual app + shared React drawing engine browser fixture verified
  placement, handle resizing, settings, labels, P&L -2.68 to +0.34 on an injected
  quote, time zoom, QQQ/SPX ticker isolation, workspace reload and profile success
  with synthetic execution rows (POC500, VAH502, VAL498). Fixture never uses live
  accounts or provider connections. Proof:
  tmp/kwanty-state-tools/proof/exact-profile-and-calculator.png.
- Reproduce: node scripts/serve-kwanty-state-tools-fixture.cjs.

## Still open — do not mark all data/tools live-verified

Cash indices do not have traded volume. The State drawing adapter currently has
exact execution VAP for supported ES/NQ sources only; a genuine equity/ETF or
option-contract volume-at-price adapter remains required for those instruments.
Ranges explicitly indicate absent exact data instead of silently substituting
GEX/OI or OHLC histograms. AVWAP needs complete reported bar volume. Provider
history, unsupported temporary gateway and full rolling archive reliability are
unchanged. Chart image export still captures the underlying canvas, not SVG
drawing overlays; workspace/template export retains drawings.

Main-only release, no preview/CLI deployment, no provider credentials changed,
no gateway restart, no new API route or continuous Vercel acquisition.
