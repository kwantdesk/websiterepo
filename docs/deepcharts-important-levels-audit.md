# DeepCharts Important Levels audit — 2026-09-07

## Evidence

- Official contract: https://www.deepcharts.com/helpcenter/article/important-levels
- Levels span configurable prior days/weeks/months with optional Skip Last.
- Per period: Average, Low, High, Open, Close, POC, Value Area and VWAP.
- Plot modes: Label, Line, Label and Line. Text alignment: Left, Right,
  Current to Right, Current to Last. Time filters: None, ETH, RTH, Custom in
  exchange time.

## Quant Desk implementation

- Daily periods use the 17:00 America/Chicago trading-date rollover; weekly and
  monthly keys derive from that trading date.
- OHLC comes from authoritative chart candles. Average is period high/low
  midpoint. VWAP is volume-weighted HLC3. POC and 70% value area aggregate
  exact one-tick execution-derived footprint rows.
- POC/VAH/VAL fail closed when volume-at-price history is absent; they are never
  inferred from candle direction or total bar volume.
- None/ETH, RTH (08:30–15:15) and overnight-safe Custom exchange-time filters,
  period counts, Skip Last, per-period level toggles, plot modes, labels,
  colours, theme following, templates and persistence are wired.

## Verification and limits

- Focused tests cover OHLC/midpoint/POC/VA/VWAP values, fail-closed profile
  levels, numeric bounds, persistence, public controls and release gates.
- Current-to-Right and Current-to-Last currently use the right-edge label
  placement while preserving the saved public option. Exact viewport-relative
  vendor label anchoring and protected pixel parity remain unclaimed.
