# Super Trend pair — implementation audit

Status: calculation prerequisite only. Both catalogue entries remain Pending.

## Integration in progress

The real engine now routes both IDs to `superTrendSeries.ts`; gates remain off.
Flat defaults/numeric sliders, dedicated style/name controls and two colour slots
are connected. Engine tests prove overlay versus histogram placement, exact
price-minus-line pairing, independent theme/custom colour ownership, scalar
roundtrip, width/styles and per-instance secondary-scale options.

The shared pane renderer now accepts an optional explicit histogram thickness:
only the new Difference output supplies it. Both horizontal and vertical paths
use `indicatorHistogramWidth`; legacy studies retain candle-body thickness.
This fixes an integration mismatch found during inspection: setting lineWidth
alone did not change histogram bars.

`SuperTrendAlertTracker` has bounded per-instance state and tests for baseline,
repeat direction, stale/disconnected/replay/closed-market input and scope reset.
It is NOT dispatched from Chart yet. The caller must supply real trade receipt
time, live eligibility and a scope that changes on backfill/settings/instrument;
render time cannot act as feed evidence. The 15-second freshness bound is an
explicit KwantDesk safety convention, not a vendor timing claim.

19 combined new math/engine/alert/width, KST renderer and catalogue tests pass.
Settings UI is wired but not browser-verified. Defaults for name/background/
marker controls are still awaiting rendering, and alerts await actual wiring.
Do not enable either Pending gate until these are complete; no no-op controls
may be released. Chart orientation/labels and alert source mapping are next.

## Reference evidence

- [DeepCharts Super Trend](https://www.deepcharts.com/helpcenter/article/super-trend):
  ATR length 10, multiplier 3, bullish/bearish colours, line style/width (1),
  short name, labels/backgrounds, auto-centre and secondary-axis controls.
  Trend changes support sound, alert name and message notifications.
- [DeepCharts Super Trend Difference](https://www.deepcharts.com/helpcenter/article/super-trend-difference):
  price minus trend in a separate horizontal or vertical histogram, same
  length/multiplier, positive/negative colours, width 4 and short name.
- [TradingView calculation reference](https://www.tradingview.com/support/solutions/43000634738-supertrend/):
  HL2 bands offset by ATR, constrained by previous bands and previous close;
  strict close crossings change direction. This supplies a public calculation
  convention, not proof of DeepCharts' protected seed implementation.

Read-only metadata inspected in the licensed installed
`C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll` using
`scripts/dotnet-metadata.py`:

- Description getters `get_SuperTrend` 0x10878 and
  `get_SuperTrend_Difference` 0x10880 exist.
- `Deepchart.Validation.IsolatedFieldChecker` exposes Length (0x2c06c),
  Multiplier (0x2c07c), EnableAlertSound (0x2c08c), AlertName (0x2c09c),
  EnableMessagePopup (0x2c0ac). Its constructor is 0x2c1a0.
- `VolAnalysis.Collections.PredicateDictionary` exposes Length (0x2c210),
  Multiplier (0x2c220); constructor 0x2c310.
- These matching shapes are evidence for settings, not independently proven
  class-to-study bindings. Constructor IL queries returned no usable bodies.
  No protected code, factory seed or exact pixel-parity claim.

## Implemented calculation

`src/lib/superTrend.ts` uses a full-window mean seed and Wilder ATR recurrence;
first true range is high minus low. The first ready output is bearish.
Direction is retained explicitly, including zero-width bands. Touches do not
reverse. Outputs contain trend, close-minus-trend, ATR, direction, reversal
and a hard-break marker after malformed data. Negative/zero prices are valid.
All OHLC must be finite and within high/low. Invalid or non-increasing bars
reset warmup, preserve timestamp high-watermark, and never fabricate values.

The forming candle is recalculated from its source prefix; no accumulating
per-render state, clock polling, volume substitution, feed request or login.
O(n) time, O(1) working state besides returned points. Maximum length 1000
fits the existing 1500-bar lite input; recursive ATR/bands still depend on
seed history, so exact cross-platform history parity needs equal input spans.

Six tests pass: hand-calculated bands and reversals, strict touches/zero and
negative prices, prefix/live replacement, malformed/reset behavior, bounds,
and an independent array recurrence across four lengths/four multipliers.
26 combined Super Trend/KST/T3/SAR tests pass; scoped ESLint passes.

## Remaining release checklist

- [x] Shared calculator and independent deterministic tests.
- [ ] Inspect official settings screenshots for exact control choices.
- [ ] Persisted bounded settings, sliders and individual theme/custom colours.
- [ ] Wire price overlay and independently scaled difference histogram.
- [ ] Labels/backgrounds/auto-centre and actual supported orientation choices.
- [ ] Functional sound/message alerts with historical-load suppression,
  per-instance identity, stale-source guard and repeat-event deduplication.
  Existing event channel: `kwantdesk:chart-indicator-alert`. Do not add no-op
  toggles or replay historical signals on mount/theme/settings changes.
- [ ] Browser settings/geometry/Save/reload and template roundtrip.
- [ ] Actual engine/history/data-path integration, performance checks and build.
- [ ] Enable only after release tests; scoped main push and exact live SHA check.

No available indicator modified. No production release for this prerequisite.
