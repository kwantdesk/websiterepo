# DeepCharts Regression Channel audit — 2026-09-07

## Public contract recovered

Official reference: https://www.deepcharts.com/helpcenter/article/regression-channel

- The study is one active linear-regression centre line plus equal upper and
  lower standard-deviation bands.
- General settings expose `Mode`, `Bars` (default `100`) and `Std dev value`
  (default `1.00`). The installed public screenshot shows `Bars` mode.
- Zig Zag settings expose `Tick reversal` / `Highest-Lowest`, absolute reversal
  (default `0.50`) and tick-reversal/highest-lowest value (default `22`).
- MID, UP and DN each expose width (default `2`), style, positive colour and
  negative colour. The public screenshot shows Dash for MID.
- The chart screenshot shows the current channel only, not a rolling channel
  painted at every historical bar. That is why this is a separate indicator
  from KwantDesk Linear Regression.

The installed DLL exposes the public description resource but its protected
implementation type/formula is not available under an unobfuscated Regression
name. No decompilation or vendor source redistribution was attempted.

## KwantDesk implementation

- `Bars` fits the latest bounded candle window and draws only that active
  segment. The centre is ordinary least squares on Close; channel distance is
  the population standard deviation of residuals multiplied by the selected
  deviation value.
- `Zig Zag / Tick reversal` starts at the latest confirmed close-price pivot
  using `max(abs reversal, tick size × reversal value)`.
- `Zig Zag / Highest-Lowest` starts at the opposite high/low extreme in the
  selected lookback, keeping the current developing leg.
- Invalid or out-of-order history restarts the calculation. It never bridges a
  missing candle with a confident line.
- MID/UP/DN widths, styles and independent rising/falling colours are live.
  Untouched colours follow the active chart theme; templates and stored
  workspaces use the shared persistence path.
- Maximum Bars is 10,000 and the chart requests deep history for this study.

## Verification and explicit limits

- Eight calculator/settings tests pass, including both modes, falling colour,
  zero deviation, history-gap behaviour and a 20,000-bar bounded-work check.
- Numeric slider (9/9), template (18/18), theme ownership, scoped ESLint,
  TypeScript and the complete 80-page production build pass.
- Synthetic browser QA verified three plotted lines, the six stable settings
  sections, exact public defaults, sliders and Save -> close -> reopen
  persistence (`Bars = 80`).
- Exact DeepCharts pivot selection, residual divisor, native pixel geometry and
  market-open latency cannot be proven from public material and are not
  claimed. The chosen conventions above are explicit and independently tested.
