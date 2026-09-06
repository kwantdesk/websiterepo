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

## Getter signature / enum evidence

Read-only `scripts/dotnet-contracts.py` now resolves public scalar getter
signatures and enum literal values, without invoking assembly code. Nine
synthetic tests cover compressed integers, rejected signatures, heap bounds,
type resolution and real Constant-table bytes. It intentionally supports only
scalar getters and early table addresses; unsupported signatures are explicit.
Signature reference: ECMA-335 II.23.2,
https://www.ecma-international.org/wp-content/uploads/ECMA-335_6th_edition_june_2012.pdf

Installed file version 16.0.9, product version 1.0.0. SHA256:
`D8366C8312AB71F1706DEA8A2A0046EB620EAC4497FB2ACF595946F381F3D9B6`.
Reproduce: `python scripts/dotnet-contracts.py ReadableMatcherMapper`.

| Getter | Exact metadata type / enum literals |
|---|---|
| InputData | ResolverBamlTreeNodeState: Volume=0, Order=1 |
| FilterMin / FilterMax / NumberOfSeconds | int32 |
| DisplayValue | SequentialProviderNodeTypes: Total=0, Counter=1 |
| FilterMode | StreamSpecialFileFlags: Automatic=0, None=1 |
| StdDevForFilter | float64 |

Enum types resolve to System.Enum through TypeRef metadata. This strengthens
the settings-shape association but does not prove the protected type is bound
to a particular catalogue row. Importantly, it contradicts assuming the public
article's Volume/Order/Trades list is the exact installed dropdown. Counter's
meaning is not proven: do not relabel it Buy/Sell/Delta, or substitute execution
count for resting orders. No constructor defaults or automatic-filter baseline
were recovered. Native offline observations and/or lawful vendor clarification
remain needed to resolve those semantics before enabling this entry.

The Instant candidate TreeResponder independently exposes Volume/Order and
Total/Counter in its own enum types. Our existing Instant document's stronger
claim about DeepCharts Buy/Sell/Delta modes is not supported by these getters;
recorded a reference correction there, with no working indicator changed.
