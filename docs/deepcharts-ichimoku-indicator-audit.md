# DeepCharts Ichimoku Indicator audit — 2026-09-07

## Outcome

`ichimoku-indicator` is now a calculated main-chart study rather than a Pending
catalogue card. It draws Tenkan Sen, Kijun Sen, displaced Chikou Span, both
forward Senkou boundaries and a live two-colour Kumo cloud.

## Evidence

- Official DeepCharts help:
  https://www.deepcharts.com/helpcenter/article/ichimoku-indicator
- The public article defines the midpoint construction for Tenkan/Kijun,
  backward Chikou displacement, forward Senkou displacement and the four
  subgraph families.
- The installed public parameter screenshot shows `9 / 26 / 52`, horizontal
  chart area 1 and secondary axis off. The public subgraph screenshot shows a
  solid Line, width 1, labels/marker off and auto-centre on.
- Licensed local DLL public metadata only: `Deepchart.dll` type
  `VolAnalysis.ResponseHandling.ResponderElement` exposes
  `ConversionLinePeriod`, `BaseLinePeriod` and `LaggingSpanPeriod`. Public
  numeric attributes bound all three to `1..1000`.
- No method body, protected formula or vendor binary was copied or distributed.

## Implemented

- O(n) rolling-high/rolling-low midpoint calculation for 20,000-bar histories.
- Stock `9 / 26 / 52` values, exact `1..1000` controls and slider/text editing.
- Standard Chikou backshift by the base period; Senkou A and the 52-period
  Senkou B boundary projected forward by the base period.
- Real cloud primitive with bullish/bearish theme colours and adjustable
  opacity. The projected cloud continues beyond the last candle.
- Per-subgraph line width, line style, short name, name/value label and
  auto-centre participation; optional secondary price scale.
- Theme ownership, custom colours, templates/export/import and stored-state
  normalization use the shared indicator paths.

## Honest parity boundary

DeepCharts' article text calls the third parameter the lagging-span period and
says 26, while its own installed screenshot shows 52. The implementation keeps
the observed 52 default and applies the standard Ichimoku interpretation: 52 is
the Senkou B lookback and Chikou is displaced by the 26-period base. That is a
standards-backed resolution of contradictory public evidence, not a claim that
the protected vendor seed/displacement code was recovered. Exact vendor pixel
colours, crossing-edge fill treatment and live-feed side-by-side parity remain
unproved.

## Verification

- `tests/ichimoku-indicator.test.mjs`: defaults/bounds, warmup, displacement,
  all five plots/cloud, theme/custom persistence and 20,000-bar performance.
- TypeScript passes.
- Isolated browser QA verifies the plotted cloud and five lines, exact sliders,
  settings sections and Save -> close -> reopen persistence.
- 13 combined indicator tests, 9 numeric-slider checks, 18 template checks,
  theme ownership and scoped ESLint pass.
- The complete 80-page production build passes. Exact deployed-SHA
  verification remains the final release gate.
