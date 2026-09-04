# DeepCharts pending-indicator overhaul

Started: 2026-09-04

## Scope and release rule

- Audit and implement only Quant Desk catalogue rows that were `browser-pending`
  at the start of this task. Existing available indicators are out of scope and
  must not be changed as a shortcut.
- Follow the catalogue from top to bottom.
- A row may move from **Pending** to **Add** only after its data contract,
  calculation, default settings, adjustable settings, themed rendering,
  persistence, loading/empty/error states, performance and regression tests
  are complete.
- DeepCharts help/settings and installed application metadata are reference
  evidence. Protected implementation details that cannot be lawfully or
  reliably inspected are not guessed; the observable contract is implemented
  against Quant Desk's licensed Rithmic/QuantData inputs and documented here.

## Evidence constraints

- DeepCharts desktop is installed and running from
  `C:\Program Files\Volumetrica Trading\Deepchart`.
- The installed `Deepchart.dll` is protected by .NET Reactor and rejects IL
  disassembly. Its public metadata/resource strings remain usable for names,
  categories, ranges and defaults, but are not sufficient by themselves to
  prove a formula.
- The current Codex computer-control provider exposes browser tabs only, not
  native Windows surfaces. UI observations must therefore be recorded only
  when native app control becomes available or when the owner supplies a
  capture. No setting or behaviour will be marked verified from assumption.

## Ordered checklist

Legend: `[ ]` not complete, `[~]` in progress, `[x]` complete and addable.

| # | Quant Desk indicator | Stable id | DeepCharts help/settings | Data + formula | Renderer + theme | Settings + persistence | Tests + visual QA | Catalogue |
|---:|---|---|---|---|---|---|---|---|
| 1 | Unfinished Auction | `unfinished-auction` | [x] | [x] | [x] | [x] | [x] | Add |
| 2 | Bar POC Indicator | `bar-poc-indicator` | [x] | [x] | [x] | [x] | [x] | Add |
| 3 | Dynamic POC | `dynamic-poc` | [x] | [x] | [x] | [x] | [x] | Add |
| 4 | Ratio Highlight | `ratio-highlight` | [x] | [x] | [x] | [x] | [x] | Add |
| 5 | Stop Spotter | `stop-spotter` | [x] | [x] | [x] | [x] | [x] | Add |
| 6 | Cumulative Iceberg/Stop | `cumulative-iceberg-stop` | [x] | [x] | [x] | [x] | [x] | Add |
| 7 | Book Speed | `book-speed` | [x] | [x] | [x] | [x] | [x] | Add |
| 8 | KWANT Delta | `deep-delta` | [x] | [x] | [x] | [x] | [x] | Add |
| 9 | KWANT Wall | `deep-wall` | [x] | [x] | [x] | [x] | [x] | Add |
| 10 | KWANT V-Tracker | `deep-v-tracker` | [x] | [x] | [x] | [x] | [x] | Add |
| 11 | Custom Draw-On Volume Profile | `custom-draw-on-volume-profile` | [x] | [x] | [x] | [x] | [x] | Add |
| 12 | KWANT Profile Swing | `deep-profile-swing` | [x] | [x] | [x] | [x] | [x] | Add |
| 13 | KWANT Profile Values | `deep-profile-values` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 14 | Market Statistics | `market-statistics` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 15 | Confluence Identifier | `confluence-identifier` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 16 | Kwant Levels | `gamma-levels` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 17 | Overlay Chart | `overlay-chart` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 18 | Overlay Symbol | `overlay-symbol` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 19 | Overlay Timeframe Candlestick | `overlay-timeframe-candlestick` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 20 | KWANT-M IVB | `deep-m-ivb` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 21 | KWANT Pattern Builder | `deep-pattern-builder` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |

## Audit notes

### 1: Unfinished Auction

- The official DeepCharts contract is the extreme-price auction rule: a normal
  high is `0 Bid / x Ask`, a normal low is `x Bid / 0 Ask`, and the opposite-side
  non-zero print marks the unfinished extreme. This is distinct from the
  similarly named **Unfinished Tracker**, which looks for intrabar zero prints.
- Installed DLL metadata confirms the exposed controls and ranges: days to
  load, line width (1–8), bad-high/bad-low colours, rectangle/background,
  opacity (0–100), None/Manual filter with manual minimum volume, extensions,
  None/Session/ETH+RTH resets, shadow-touch removal, and None/ETH/RTH/Custom
  time filtering.
- Quant Desk now requires exact volume-at-price rows from classified Rithmic
  executions. It never derives an unfinished auction from OHLC direction. The
  renderer has theme-linked bad-high/bad-low colours, background/rectangle
  modes, lifecycle extensions and an explicit waiting state when exact rows
  are unavailable.
- Automated coverage passes for normal-vs-unfinished extremes, manual volume
  filtering, wick-vs-close triggering, settings bounds, missing-data refusal,
  and the 08:30 Chicago RTH reset. TypeScript and whitespace validation pass.
- Production QA on commit `5bbd1758` confirmed the sole active Vercel project
  reached Ready, the study adds/removes normally, reports live state, and its
  stable General/Input/Style editor exposes theme colours, numeric sliders,
  templates and saved-state status without leaking controls into other studies.

### 2: Bar POC Indicator

- Official DeepCharts help and installed DLL metadata agree on Volume, Order
  and Aggregate Trades inputs; execution-size min/max; None/Manual/Automatic
  POC filters; a separate exchange/custom-RTH filter; bid/ask rectangle
  colours; background and opacity; virgin POC extensions; new-day reset;
  wick-touch or close-break termination; maximum bars; tick breakout margin;
  hide-on-break; and duration text.
- Quant Desk computes the maximum metric on each candle's exact price rows,
  resolves tied maxima deterministically toward the metric-weighted centre and
  close, and colours the row by its actual signed Bid/Ask delta. Its automatic
  filter is an explicit population mean plus the selected standard-deviation
  multiple; it is not presented as a recovered proprietary algorithm.
- The extension lifecycle evaluates every later candle, stops at the optional
  CME trading-day boundary, respects max-bars and tick margin, and distinguishes
  wick-touch from close-through. Missing volume-at-price produces a visible
  waiting state rather than an OHLC-derived fake POC.
- Focused tests and TypeScript pass. Production commit `5b48a67d` reached Ready;
  visual QA confirmed a LIVE exact-price level, stable settings, templates,
  theme-linked colours and clean add/remove behaviour.

### 3: Dynamic POC

- Official help defines the rolling/developing POC of the last n minutes or
  bars with optional standard-deviation envelopes. Installed DLL metadata adds
  the complete modes Daily, Minute, Bars, Last Days and Last Minutes; period
  range 1–10,000; Standard Deviation or Price Percentage envelopes; and three
  independently adjustable deviations in 0.25 increments.
- Quant Desk maintains an incremental exact-price volume histogram: entering
  bars are added once and expired bars are subtracted once. Each point resolves
  the maximum-volume tick deterministically, with envelope distances calculated
  about that POC. Minute buckets use Chicago exchange time and daily mode uses
  the CME trading-day boundary.
- The themed canvas renderer draws the VPOC and each enabled upper/lower band,
  breaks safely when data is unavailable, and exposes period, envelope,
  visibility, width, colour, template and save controls. Focused rolling-window,
  envelope, bounds and unavailable-data tests plus TypeScript pass; deployment
  pass. Production commit `dd308fba` reached Ready; a cache-busted production
  load confirmed the study is addable, reports LIVE, renders without a pane,
  and exposes the complete General/Input/Style editor with templates, numeric
  sliders and theme-linked colours. The temporary QA instance was removed.

### 4: Ratio Highlight

- Official help and the installed `CombinedViewerNode` metadata agree on three
  modes: Bar, High and Low; decimal minimum/maximum ratio; separate Bid and Ask
  absorption colours; and marker opacity capped at 100. The reference defaults
  visible in DeepCharts are Bar, minimum 10, maximum 20 and opacity 70.
- This standalone study is not Footprint's diagonal cell imbalance ratio.
  Ratio High is Ask at the penultimate upper tick divided by Ask at the bar's
  highest tick; Ratio Low is Bid at the penultimate lower tick divided by Bid
  at the lowest tick. Bar mode tests High only on bearish candles and Low only
  on bullish candles, matching the documented contract.
- Quant Desk now calculates those values only from exact one-tick classified
  Rithmic execution rows. Zero/missing extreme denominators and OHLC-only bars
  are refused instead of fabricating a marker. The minimum and optional maximum
  filters apply to the raw ratio.
- The main-pane primitive paints a full-height stripe aligned to the qualifying
  candle, behind price, using theme-linked Ask/High and Bid/Low colours. The
  settings modal exposes the three modes, both bounds, opacity, colours,
  templates and saved-state handling. Focused formula/mode/bound/missing-data
  tests, TypeScript and whitespace checks pass. Production commit `62dab2d3`
  reached Ready; production QA found and corrected a React status-publication
  starvation edge case in `c4f837db`. A cache-busted production load then
  confirmed LIVE state, visible marker rendering under permissive test bounds,
  complete settings and clean removal of the temporary QA instance.

### 5: Stop Spotter

- Current official help and the installed `ProxyNode` metadata expose the full
  detection contract: minimum delta percentage, total volume, volume increase,
  body ticks, price continuation ticks, horizontal delta, imbalance percentage
  and count, Close/Seconds-to-close calculation modes, plot price, contract
  sizing, alert/popup and generic subgraph controls. The observable defaults are
  25%, 1,500, 500, 6, 1, 60, 200%, 2, Close and 15 seconds.
- The protected formula body is not inspectable, so Quant Desk implements and
  documents an explicit conjunction of those conditions rather than claiming a
  copied proprietary formula. It operates only on exact Rithmic classified
  volume-at-price rows and refuses OHLC-only data. Close mode evaluates closed
  bars; Seconds-to-close can evaluate the forming bar only when a deterministic
  clock-bar close is known.
- Buy and sell candidates require aligned candle direction and delta, then pass
  every threshold. Horizontal delta is evaluated at each price row and the
  imbalance gate uses consecutive diagonal Ask/Bid comparisons. Marker price,
  five shapes, width/style, labels, backgrounds, theme/custom/chart colour,
  alert fields and instrument tick-value-aware contract sizing are wired.
- Focused tests cover both sides, each independent detection threshold, forming
  bar timing, missing source data, settings bounds and contract sizing. The full
  TypeScript and whitespace checks pass. First production QA on `e1915095`
  confirmed Add, LIVE state and the complete General/Input/Style contract, and
  caught an invisible Chromey Mono sell-marker seed before release. Marker and
  contract colours now use the shared visibility-safe theme palette; the
  corrective commit `fe45bbf4` reached Ready. Cache-busted production QA
  confirmed the Chromey Mono sell and contract text are now `#B9C0B9`, then
  removed the temporary instance and restored the chart to 11 indicators.

### 6: Cumulative Iceberg/Stop

- The current official DeepCharts help exposes Volume/Order input, minimum and
  optional maximum filtering, separate Iceberg Ask/Bid and Stop Bid/Ask
  colours, Sum/Last Minutes/Last Seconds display modes, a display parameter,
  line width, optional separate axes and independent Stop/Iceberg alerts.
  Sum is a signed cumulative total; the two rolling modes retain only the
  selected minute/second window.
- Quant Desk's Volume mode is wired to a dedicated Rithmic stream consumer. It
  combines verified aggressive executions with price-level book lifecycle:
  confirmed replenishment candidates feed the Iceberg line, while aggressive
  sweeps that breach an auditable candle/chart reference feed the possible
  Stop line. Bid-side activity adds and Ask-side activity subtracts. A detector
  event is replaced at its latest size rather than counted again on every book
  update.
- DeepCharts states that its stop reconstruction is proprietary, and protected
  DLL metadata does not disclose that formula. Quant Desk therefore labels the
  Stop plot as inference and does not claim source-code parity. The current
  gateway also reports `nativeSupport: false` and `makerOrderSupport: false`;
  Order mode is present to match the contract but explicitly reports
  `ORDER_IDS_REQUIRED` and never substitutes trade count for individual MBO
  orders.
- The lower pane has two side-coloured lines, a zero reference, shared or
  independent scaling, status/count/badge output, tooltips, theme/custom
  palettes, numeric sliders, templates and alert controls. Events on range,
  volume and other synthetic-time charts are anchored to their actual chart
  bars rather than creating whitespace. Focused tests cover signed accumulation,
  rolling expiry, both filters, capability refusal and frame construction;
  TypeScript passes. Commit `d635bf8e` reached Ready on the sole active Vercel
  project. Cache-busted production QA on NQ 500-volume confirmed Add, event-bar
  anchoring, honest no-event state, every numeric slider and settings group,
  the explicit maker-ID refusal in Order mode, save-without-false-prompt and
  clean removal of the temporary instance back to the original 11 studies.

### 7: Book Speed

- Official DeepCharts help (updated 19 June 2026) defines Book Speed as the
  number of Bid and Ask book price levels consumed per measurement. The two
  documented modes are Seconds and Tick Reversal, both driven by one parameter
  value. The plot contract is opposing Bid/Ask histograms around zero, optional
  moving-average lines with length and colours, and optional positive/negative
  marker thresholds with colours.
- Quant Desk counts a level only when displayed liquidity at that exact price
  is exhausted and the same shared Rithmic frame contains an aggressive trade
  through that price. A pull, cancellation or partial reduction cannot count.
  Duplicate execution batches are suppressed. Seconds mode creates fixed
  exchange-time windows; Tick Reversal closes the active measurement only
  after price reverses the requested number of instrument ticks from its
  running extreme.
- The study shares the existing coalesced Rithmic subscription, adding no new
  endpoint polling. It renders Bid above zero and Ask below, two optional
  rolling averages, paired marker lines, exact current values, status, tooltips
  and explicit stale/unavailable/warm-up states. Synthetic event charts remap
  every bucket to a real drawn candle and never insert time-scale whitespace.
- General/Input/Style settings include the two modes, parameter, average,
  marker, width, bounded history, pane height, theme-safe/custom colours and
  shared account-synced template import/export. Focused tests cover both sides,
  duplicate suppression, cancellation refusal, partial-consumption refusal,
  fixed time windows, averages and tick-reversal closure. TypeScript, template
  and shared Rithmic frame-budget checks pass, as does the full production
  build. Commit `a3213f64` reached Ready as deployment
  `86oE7DzFHzsDZ3LrbKv2BZyPESdF` on the sole active Vercel project.
  Cache-busted production QA on NQ 500-volume confirmed real shared-Rithmic
  Bid/Ask counts, LIVE state, Seconds/Tick Reversal switching, every numeric
  slider, immediate saved state with no false close prompt and clean removal
  of the temporary study back to the original 11 indicators.

### 8: KWANT Delta

- Current official DeepCharts help describes Deep Delta as an advanced Delta
  Bar with Volume, Aggregate Trades, Trades and Order inputs; Classic and
  Multi Range modes; consecutive bar grouping; four independently enabled
  min/max magnitude ranges where zero means unlimited; two optional mirrored
  threshold levels; and a Struggle marker when both positive and negative
  delta extremes cross its threshold in one grouped bar. Current help images
  show the observable defaults: Volume, Multi Range, four bars grouped,
  ranges 1-10 / 11-20 / 21-30 / 31+, disabled 1000 and 1500 dashed threshold
  pairs, and a disabled zero-threshold Struggle marker.
- Quant Desk implements that observable contract as its own deterministic
  KWANT Delta calculation. Volume and Aggregate Trades consume only classified
  Rithmic Bid/Ask executions and retain the exchange-sequenced delta high/low
  carried by each candle. Trades and Order use recorded signed execution
  counts; they never relabel contract volume as an order count. Consecutive
  source bars accumulate from zero and the forming partial group remains live,
  so a four-bar setting does not freeze the pane until the fourth close.
- The separate pane renders Classic positive/negative bodies or all four
  Multi Range colour tiers, plus distinct maximum-positive and
  minimum-negative shadows, optional mirrored threshold rails and optional
  Struggle markers. Empty plots retain stable colour-slot identities across
  mode/toggle changes. Theme-following colours remain contrast safe, while a
  trader can explicitly choose every DeepCharts-visible subgraph colour.
- General/Input/Style exposes all modes and toggles, finite numeric bounds and
  shared number sliders, line styles, theme/custom palettes and account-synced
  templates. Index/OHLC-only feeds show a capability message instead of fake
  delta. Focused tests cover normalization, ranges, grouping, sequenced
  extremes, the live partial group, count inputs, missing-data refusal and a
  20,000-bar linear-performance case. TypeScript and the production build pass.
  Commit `1933bbca` reached Ready as deployment
  `2o38r1KkND2RoC36UdqYevd9GK4C` on the sole active Vercel project.
  Cache-busted production QA on NQ 500-volume confirmed Add, real positive and
  negative grouped bars with live values, every General/Input/Style control,
  Classic/Multi Range switching, immediate saved state with no false close
  prompt and clean removal of the temporary study back to 11 indicators.

### 9: KWANT Wall

- Official DeepCharts help scopes Deep Wall to ES and describes passive walls
  that absorb aggressive flow at an important high/low and reject price.
  Installed DLL metadata recovers its exposed defaults: tick breakout 1,
  delta 70%, per-bar volume 20, cluster volume 300, grouping 1, extreme minimum
  2 bars, nearness 50 bars, Price Slope/High/Low plot price, sound and popup.
- The protected formula is not inspectable. Quant Desk implements an explicit
  detector: ES/MES only; classified Rithmic volume-at-price concentrated at a
  recent extreme; extreme-side aggressive delta and volume; then a confirmed
  rejection. OHLC-only candles, unclassified volume and cancellations cannot
  create a wall marker.
- Its compact horizontal markers follow the shared contrast-safe theme by
  default and allow custom side colours, width and opacity. Every recovered
  input has a typed value and slider; templates, save state, alert controls,
  unsupported-instrument and missing-data states are wired.
- Focused formula, rejection, scope, missing-data and bounds tests pass, as do
  TypeScript, focused lint, templates, theme following, numeric sliders and the
  full production build. Commit `763da125` reached Ready as deployment
  `FihkgZxzX6viWZwFLxGZ6gHkvoaK` on the sole active Vercel project. Cache-busted
  production QA confirmed Add, an explicit `UNSUPPORTED INSTRUMENT` state on
  NQ rather than a false wall, the complete General/Input/Style surface,
  immediate saved state with no false close prompt and clean removal back to
  11 indicators.

### 10: KWANT V-Tracker

- Official DeepCharts help defines two modules. Patterns detects Acceleration,
  Exhaustion and Slowdown; Absorption & Pressure draws bid/ask control (`C`)
  and extreme (`E`) levels. The installed 16.0.9 DLL metadata exposes Weak,
  Medium and Strong modes for all four detectors, Conservative/Aggressive/
  Medium level modes, control/extreme widths (0-8), bid/ask colours, text size,
  Number of Bar, Extend far right and sound/message alerts.
- The DLL's protected detector body is not inspectable. Quant Desk therefore
  implements the observable contract without claiming private coefficients:
  classified Rithmic execution-speed anomalies for Acceleration/Slowdown,
  failed extremes with fading signed flow for Exhaustion, and exact row-level
  dominance plus close location for Pressure/Absorption. OHLC-only candles
  return `WAITING FOR VOLUME AT PRICE` and cannot manufacture a signal.
- The stock view follows DeepCharts' current recommendation: Acceleration and
  Absorption/Pressure enabled, Exhaustion and Slowdown available but off to
  avoid clutter. Pattern fills and `PC/PE/AC/AE` levels render on the price
  pane, terminate at their configured projection or invalidating close, and
  can extend to the live edge. Every exposed control has a typed setting,
  theme/custom colours, slider where numeric, account-synced templates and
  alerts.
- Focused behavior, data-refusal, bounds and 20,000-bar linear-performance
  tests pass, along with TypeScript, focused new-file lint, templates,
  theme-following, numeric sliders, the shared Rithmic frame budget and the
  production build. The broad plot-colour test still stops only at its existing
  unrelated MACD custom-signal assertion. Commit `85cc2949` reached Ready as
  deployment `4UDZQyZQgzee6X3mQcdDkTdd1aDQ`; cache-busted production QA on NQ
  500-volume confirmed nine live signals, every documented control, immediate
  saved state with no stale close prompt, and clean removal back to 11 studies.

### 11: Custom Draw-On Volume Profile

- Installed DeepCharts 16.0.9 metadata identifies this as the chart drawing
  action `CHART_DRAW_VOL_PROFILE`, with visible Volume Profile, Profile
  Settings, `% Value Area`, Filter outside Value Area and Show As Profile
  concepts. It is therefore correctly modelled as an anchored chart object,
  not as a persistent zero-anchor study row.
- The library Add action now arms Fixed Range Volume Profile on the selected
  chart. Its two anchors, drawing settings and templates use the existing chart
  drawing persistence contract, so the entry stays reusable rather than
  pretending a singleton study was added.
- Committed ranges request exact custom-period Rithmic execution rows with
  contract, start/end, tick grouping, value-area percentage and min/max trade
  filters. Anchor movement is debounced so dragging cannot create an API storm;
  response signatures prevent stale ranges or settings from painting. The
  existing candle-volume geometry is only the immediate loading fallback.
- The renderer draws the histogram plus independently configurable POC, VAH
  and VAL lines/labels. Price grouping, execution filters, row density, value
  area, width, fills, line toggles/widths/colours and templates are exposed.
  Focused exact-row conversion and arming tests, fixed-range level regression,
  templates, theme following, numeric sliders and TypeScript pass. Commit
  `efad055c` reached Ready as deployment `CCdWn32JQCkX8BtaNG7YSwVxQUBy`.
  Cache-busted production QA drew an exact custom profile on NQ with visible
  VAH 29172.27, POC 29165.21 and VAL 29150.09, changed price grouping from 4
  to 21, verified the full settings surface and removed the temporary drawing.

### 12: KWANT Profile Swing

- Official DeepCharts help defines five profile modes (Volume, Ask Bid Volume,
  Delta, Delta and Total Volumes, Delta Percentage), Swing/VWAP length,
  optional reversal-bar inclusion and Profile And Lines/Lines Only display.
  Its main and optional stop swing groups expose Highest Lowest, Left Right
  Bar, Absolute Reversal and Reversal Tick detection; VWAP mode exposes swing
  minimum, maximum and break ticks. DLL metadata confirms those groups plus
  the shared profile data, grouping, visual, POC, Value Area and VWAP controls.
- Quant Desk detects the selected swing contract over chart bars and builds
  each resulting distribution exclusively from exact classified Rithmic
  volume-at-price. Nonzero execution filters are applied to individual prints
  before price aggregation; flow-only historical summaries and OHLC direction
  cannot manufacture rows. Missing exact flow produces an explicit waiting
  state.
- The active swing updates with the shared execution tape and renders through
  an independent native profile primitive, insulating all existing Daily,
  Weekly, Composite and fixed-range profiles. Profile modes, lines-only,
  POC/VAH/VAL/VWAP, theme/custom colours, numeric sliders and account-synced
  templates are wired. Detection is bounded for long event-bar histories.
- Focused normalization, four detector families, exact aggregation, execution
  filtering, missing-data and 20,000-bar performance tests pass, together with
  TypeScript, focused lint, templates, theme-following, numeric-slider checks
  and the production build. The first production pass exposed an open-ended
  event-bar boundary (`Infinity`) reaching date/renderer code; commit
  `f9ca54e4` now guarantees finite profile boundaries and includes that exact
  regression. The final default-precision correction is commit `3c76312c`,
  Ready in deployment `4t5xj1ZgP6yXE9VFiGeP1EMJnrN8`. Cache-busted
  production QA on NQ 500-volume confirmed a live profile with VAH/POC/VAL,
  exact `10` and `5` reversal defaults, immediate saved state, recovery of the
  persisted study after reload and clean removal back to 11 studies.

- Quant Desk already has a tested `PocAuctionSuiteEngine` driven by exact
  execution-classified Footprint rows. It calculates raw-tick unfinished
  auction states, per-bar POC and developing/session POC without manufacturing
  bid/ask volume from OHLC candles.
- These three pending entries must be independent, focused views over that
  shared calculation contract. They must not alter or alias the existing
  available **POC & Auction Suite** instance in a user's workspace.
- The DeepCharts **Unfinished Settings** group with `Minimum Tick Vol`,
  `Max Unfinished Threshold`, `Min. Num. of Consecutive Zero`, and `Marker
  Price` belongs to **Unfinished Tracker**, not **Unfinished Auction**, and will
  not be mixed into item 1.
