# DeepCharts FVG Identifier audit — 2026-09-07

Official reference: https://www.deepcharts.com/helpcenter/article/fvg-identifier

## Observed public contract

- The official settings screenshots expose three stable sections: General,
  Plot Settings and Extension.
- General defaults are Min num ticks `10` and Max num ticks `0` (`0` is
  treated as unlimited).
- Plot defaults are Line Width `1`, green Up Color, red Down Color and Back
  Opacity `40`.
- Extension defaults are Reset Start Day on, Remove Line On Shadow Triggered
  off, Max bars extension `0` and `% breakout` `35`.
- The official chart example paints bordered bullish and bearish rectangles
  from the detected imbalance toward later candles.

The installed licensed assembly exposes the matching public type
`Deepchart.Evaluation.EvaluatorTransformer` and properties `MinNumTicks`,
`MaxNumTicks`, `LineWidth`, `UpColor`, `DownColor`, `RectangleOpacity`,
`ExtendResetOnStart`, `ExtendShadowTriggered`, `MaxBarsExtension` and
`PercBreakout`. Metadata confirms the category/display names, an eight-unit
line-width maximum and a 100-percent opacity maximum.

## KwantDesk implementation

- A bullish FVG is the strict three-candle condition `candle[2].low >
  candle[0].high`; a bearish FVG is `candle[2].high < candle[0].low`. A zone
  first appears on the third candle, so no future candle is consulted.
- Tick-size minimum and maximum filters are applied to the actual gap. The
  maximum of zero is unlimited.
- `% breakout` controls mitigation depth. Close values are used by default;
  enabling Remove Line On Shadow Triggered uses wick extremes.
- Max bars extension and the 17:00 America/Chicago trading-day reset stop a
  zone without creating synthetic future timestamps. An unmitigated,
  unlimited current-session zone reaches the visible pane edge through the
  chart primitive.
- Invalid or non-monotonic candles are hard continuity boundaries. The first
  mitigation lookup uses a segment tree, keeping the scan bounded at
  `O(n log n)` rather than comparing every zone to every later candle.
- Theme-linked and custom up/down colours, opacity, border width, sliders,
  templates and saved-settings normalization use the shared indicator paths.

## Verification and limits

- Nine focused calculation/contract tests and the existing Gap Detector suite
  pass, including future safety, tick filters, close/wick mitigation, session
  reset, extension, gap boundaries, colours and a 20,000-bar performance gate.
- Isolated browser QA verified the three sections, plotted bullish/bearish
  zones, slider editing, clean Save state and persistence after reload.
- TypeScript and the complete 80-page production build pass. Shared numeric
  slider, template, theme-follow and colour-control regressions pass.
- Three wider assertions already fail outside this scope: legacy palette/slot
  bookkeeping for previously released studies and the existing fixed-header
  Save assertion. FVG is absent from every reported mismatch and its browser
  Save/reload path passes; this release does not rewrite working studies to
  conceal those baseline failures.
- The protected vendor calculation body was not inspected. The implementation
  uses the standard public three-candle definition and the observable settings
  contract; exact proprietary tie, session-edge, mitigation and native-pixel
  parity are not claimed without controlled side-by-side market data.
