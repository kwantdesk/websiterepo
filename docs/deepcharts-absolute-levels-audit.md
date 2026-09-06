# Absolute Levels — 2026-09-06

Request: engineer the remaining Pending indicators individually using DeepCharts
reference evidence, not blanket catalogue enablement.

## Reference contract

- Official documentation: https://www.deepcharts.com/helpcenter/article/absolute-levels-indicator
- Vendor documentation: https://help.volumetricatrading.com/en/support/solutions/articles/204000003328-absolute-levels
- Read-only installed DLL metadata (`scripts/dotnet-metadata.py --methods
  TransformableModelEnumerator`) identifies
  `Deepchart.Collections.TransformableModelEnumerator` with FirstValue,
  SecondValue, FirstLineColor/Style/Width and SecondLineColor/Style/Width.
- Two manually entered prices; independent colour, style and thickness. No
  volume, execution classifier or proprietary computed signal is involved.
- KwantDesk defaults are explicitly 0/0, solid, width 1, theme colours. These
  are not claimed to be DLL-confirmed stock defaults. Protected method bodies
  and side-by-side DeepCharts pixel parity are not verified.

## Implementation and verification

- Dedicated calculator emits only two real timestamp anchors, not a history
  scan. Prices remain exact, including zero/negative values. Invalid values
  are omitted rather than manufactured. Millisecond candle timestamps convert
  to chart seconds without rounding event bars.
- Actual overlay renderer draws full-pane horizontal price lines with each
  level's own style/width/colour; they cannot compress candle autoscaling.
  Existing indicators retain their prior no-price-line behaviour.
- Eight reference settings plus existing theme, visibility and template
  infrastructure. Adding this manual-price indicator opens its settings.
- Five new executable tests cover exact values, invalid inputs, colour/style,
  normalization, actual Chart.tsx option execution and 100,000 input candles
  producing only two points. Registration regressions pass (three tests).
- Production build passed after correcting an initial Candle.time versus
  Candle.timestamp type error: TypeScript and all 80 static pages passed.
- Browser QA uses `node scripts/serve-indicator-preview.mjs`: isolated
  localhost, synthetic data clearly labelled, real settings component and
  calculator, actual renderer option source. Both lines visibly span the
  chart; editing 100.25 to 100.75 moves the first line; Save immediately shows
  ALL CHANGES SAVED; closing produces no save prompt. Reload retains 100.75
  through the fixture's local persistence. This is not a cloud-account save
  or live-market test. Existing normalization is separately tested.
- No DeepCharts window was present on the controllable desktop. Requested
  offline/replay opening for later reference comparison; did not start a
  second live Rithmic login or alter any feed/infrastructure.

Outcome: implemented and locally verified, not full-library completion.
The remaining-library checklist remains authoritative.
