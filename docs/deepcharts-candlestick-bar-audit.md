# DeepCharts Candlestick Bar audit — 2026-09-07

## Evidence

- Public contract: https://www.deepcharts.com/helpcenter/article/candlestick-bar
- Supporting price-construction definitions:
  https://www.deepcharts.com/helpcenter/article/price-settings
- The public settings are Parameter Type (`Minutes`, `Vol Bars`, `Range`),
  Parameter 1, Parameter 2, Positive/Negative Bar, filled body, candle width,
  border width, opacity and vertical line on close.
- DeepCharts defines Vol Bars as a target/reversal price construction. It is
  not the separately documented fixed-volume chart type.

## Quant Desk implementation

- Minutes aggregate the loaded authoritative OHLC history.
- Range uses the instrument's real tick size and exact execution sequence.
- Vol Bars waits until Parameter 1 target ticks are reached, then a Parameter
  2 reversal from the active extreme starts the next bar.
- A reversal execution is assigned to the new bar once; no volume, trades or
  delta are copied into the completed bar.
- `flowOnly` historical summaries are excluded from event construction.
- The overlay supports theme-linked/custom positive and negative colours,
  fill, width, border, opacity and close-boundary lines. Settings persist via
  the shared indicator/template path.

## Verification and limits

- Focused tests cover target/reversal formation, exact order-flow allocation,
  minute aggregation, Range fail-closed behavior, bounds, persistence, theme
  ownership, controls and catalogue gates.
- Public behavior and settings are implemented. Protected DeepCharts pixel
  rendering and unpublished edge rules were not recovered from the protected
  DLL and are not claimed as exact parity. A live-market visual soak remains
  required.
