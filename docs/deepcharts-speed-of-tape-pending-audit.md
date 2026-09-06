# Speed of Tape (ordinary) — research in progress

Do not alias this Pending catalogue row to the already working Instant meter.

Official reference, retrieved 2026-09-06:
https://www.deepcharts.com/helpcenter/article/speed-of-tape
describes Volume/Order/Trades input, minimum/maximum activity filters, a
seconds interval, deviation filtering and separately styled bull/bear candles.
It does not specify the precise deviation baseline or window-to-candle
aggregation. Do not invent these and claim one-to-one parity.

Read-only installed DLL metadata provides two distinct public contracts:

- `VolAnalysis.Mapping.ReadableMatcherMapper`: InputData, FilterMin,
  FilterMax, DisplayValue, NumberOfSeconds, FilterMode, StdDevForFilter.
  This is the ordinary-study candidate, matching its documented filters.
- `VolAnalysis.ResponseHandling.TreeResponder`: InputData, FilterMin,
  FilterMax, DisplayValue, NumberOfSeconds, BarsToShow, ScaleMinValue,
  PlotReversed, MeterBarLineWidth, four meter body/shadow colours and text
  settings. This matches the existing Instant rail contract.

Reproduce with `python scripts/dotnet-metadata.py --methods
ReadableMatcherMapper` (or `TreeResponder`). Type association for the ordinary
study is inferred from its settings, not recovered executable logic. An IL
probe of ControlReadableService did not expose a usable algorithm; constructor
probe did not produce defaults. Protected formula/default parity is unproven.

Next: inspect the ordinary study in offline/replay DeepCharts (without a
second live Rithmic login), capture filter-mode options/defaults and establish
the window, deviation and chart-bar behaviour with controlled observations.
Then wire real executions, explicit data availability, settings, renderer and
regressions. Orders must not be fabricated from trade counts. No gate changed
and the existing Instant calculator was not modified in this research step.
