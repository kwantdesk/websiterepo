# DeepCharts Zig Zag audit

Date: 2026-09-07

## Result

Quant Desk's `zig-zag` catalogue row now runs as a real chart study. It has
three calculation modes, separate rising/falling plots, a developing final
leg, retracement levels, complete numeric sliders, theme/custom colours,
saved-state normalization and the shared template import/export path.

## Evidence used

- Official DeepCharts help: https://www.deepcharts.com/helpcenter/article/zig-zag
- Read-only licensed assembly metadata from the locally installed
  `Deepchart.dll`: `ZigZagMode` (`AbsoluteReversal`, `TickReversal`,
  `HighestLowest`), percentage/tick-high-low parameters, up/down colours,
  line width, and the 38.2/50/61.8/75 retracement/style properties.
- Published settings captures establish the stock contract: Highest lowest,
  parameter 10, absolute reversal 0.50%, main width 2; 38.2/50/61.8 enabled,
  75 and Extend right disabled; retracement font 11 and line width 1.

## Quant Desk calculation contract

- Highest lowest confirms a running extreme after the configured number of
  bars without a new extreme.
- Absolute reversal confirms a pivot after price reverses the configured
  percentage from the running extreme.
- Tick reversal uses the selected instrument's real minimum tick. If no valid
  tick contract reaches the engine, that mode returns no plot rather than
  guessing a tick size.
- Confirmed pivots never move. The last unconfirmed extreme remains
  provisional and follows the forming candle.
- Retracements are calculated from the newest swing. Extend right reaches the
  visible chart edge; otherwise the levels end at the latest swing pivot.

The protected vendor formula body is not inspectable. Equal-high/low tie
handling, intrabar ordering and pixel-level geometry therefore are not claimed
identical. The behavior above is deterministic, public-contract compatible
and does not invent tick data.

## Verification

- Eight focused tests cover defaults, bounds, alternating pivots, tick-size
  fail-closed behavior, all three plot colours, retracement math/geometry,
  persistence and catalogue registration.
- A 20,000-candle regression proves the highest-lowest path stays linear and
  within the chart's deep-history calculation budget.
- `npx tsc --noEmit` passes.
- Isolated browser QA used synthetic candles and no market connection. It
  verified alternating themed lines, the developing leg, visible 38.2/50/61.8
  levels and stable General/Zig Zag/Retracement/Style settings pages.
