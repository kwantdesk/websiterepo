# DeepCharts On Candle Stats audit — 2026-09-07

## Evidence

- Public contract: https://www.deepcharts.com/helpcenter/article/on-candle-stats
- Public subgraphs: Max/Min Delta, Total Volume, Delta Volume, Total Trades,
  Delta Trades, Extension, COT High, COT Low, COT Bar, Bid-Ask/Vol and Ratio.
- Public controls cover Volume/Order/Aggregate Volume input, min/max filters,
  font/minimum font, auto format, absolute sign, ratio opacity, delta text
  color, tick offset and High/Low/Center/Price Slope/Delta Sign placement.

## Quant Desk implementation

- Reuses the already-audited execution-sequenced KWANT Stats calculator while
  preserving KWANT Stats as a separate lower-pane product.
- A dedicated Lightweight Charts primitive anchors per-bar text boxes to the
  selected price rule and scales text with chart zoom.
- COT is folded from the last exact low/high touch through close. Trade delta
  uses classified buy/sell execution counts. Price-level ratios use exact
  high/low tick rows. Missing sequencing produces no fake value.
- Input filters correctly distinguish Order (trade count) from Volume and
  Aggregate Volume (contracts). Theme/custom colors and shared templates are
  supported.

## Verification and limits

- Focused tests cover ordered COT/delta/ratio values, input filter semantics,
  persistence, controls, primitive wiring and release gates.
- Public settings and behavior are covered. Protected font layout, collision
  policy and pixel parity are not claimed; live-market visual soak remains.
