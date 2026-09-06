# DeepCharts Price Movement Levels audit — 2026-09-07

## Evidence used

- Public contract: <https://www.deepcharts.com/helpcenter/article/price-movement-levels>
- Licensed installation metadata: public type `Deepchart.Selections.SelectorExplorer`.
- Controlled DeepCharts settings inspection captured the installed defaults and
  section layout. Protected method bodies were not inspected or copied.

## Recovered contract

The installed default is three days, Open, Percentual, `0.500`, font size
`11.00`, five minimum levels, green dashed support width 2, purple dashed
resistance width 2, yellow dotted zero width 2, and a disabled `00:00:00` to
`00:00:00` exchange-time custom session. The public article defines positive
levels as resistance, negative levels as support and zero as the base anchor.

KWANTDESK exposes the same General, Support Line, Resistance Line, Zero Line
and Custom Time Session groups. Every numeric value uses the shared typed
slider; colors follow the current chart theme unless explicitly overridden;
settings use the normal account template/export/import path.

## Calculation and safety decisions

- Open mode anchors each exchange-local session at its first valid candle open.
- Close mode projects the previous completed session close into the next
  session. It never rewrites a session's past from its still-forming close.
- Percentual mode compounds each step from the session anchor. Tick mode uses
  the actual instrument tick size and refuses to plot when it is unknown.
- At least the requested number of levels is drawn on each side; more are
  added to cover the observed session range, bounded at 20 per side to keep
  multi-pane interaction predictable.
- Invalid and out-of-order candles create a hard seam. Levels do not bridge
  suspect history.
- Lines start on their owning session and end on its last loaded candle; no
  synthetic future timestamp is created.

## Honest parity limits

The article documents the settings and high-level behavior, but not protected
rounding, boundary-inclusion or session-close internals. Exact private-formula
or native-pixel parity is therefore not claimed. The licensed desktop accepts
line widths up to 6; Lightweight Charts' public web type supports 1–4, so the
web control honestly exposes 1–4 instead of accepting values it cannot render.

## Verification

- Seven focused calculation, session, tick-size, persistence, theme and
  registration tests pass.
- Shared numeric-slider 9/9, template 18/18 and theme-follow 8/8 suites pass.
- TypeScript passes. The broad plot-colour suite has only its already-recorded
  unrelated Ichimoku/SAR/Linear/SuperTrend/T3/KST/Text mismatches; this study
  introduces none.

