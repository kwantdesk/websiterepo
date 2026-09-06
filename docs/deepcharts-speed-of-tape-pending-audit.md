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

## Official screenshot observations, 2026-09-06

Inspected the actual article images in the in-app browser (not inferred from
article prose). These are observed screenshot values, not proof of constructor
defaults or protected formula behaviour:

- Parameters image: https://framerusercontent.com/images/i37RLm0bKZDqajboRifxzFVU.png
  Volume input, minimum 1, maximum 0, Total display, 10 seconds, Automatic
  filter mode, standard-deviation filter 0.30. Horizontal chart area 2;
  secondary axis off. Dropdown alternatives are not exposed by a static image.
- Subgraphs image: https://framerusercontent.com/images/6SNrGzjEAgyzdY6RF0SwfkigRZU.png
  Four bull/bear border/fill slots, Candlestick style, Auto Color None, solid
  width 1, blank short name. Name/value labels and their backgrounds off;
  chart-color marker off, Include on Auto Center on. Visible colours are
  teal/green bull and pink/red bear; exact RGB values not measured.

Computer-use skill read; initialized @oai/sky and queried existing windows.
No DeepCharts window returned. No application launch, credential action or
new Rithmic session attempted. Automatic baseline, OHLC construction and filter
mode enum still need evidence; this row remains Pending. Do not reuse the
Instant bar totals and mislabel them as verified ordinary tape candlesticks.
