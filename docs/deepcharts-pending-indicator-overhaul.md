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
| 6 | Cumulative Iceberg/Stop | `cumulative-iceberg-stop` | [x] | [x] | [x] | [x] | [~] | Release candidate |
| 7 | Book Speed | `book-speed` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 8 | KWANT Delta | `deep-delta` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 9 | KWANT Wall | `deep-wall` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 10 | KWANT V-Tracker | `deep-v-tracker` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 11 | Custom Draw-On Volume Profile | `custom-draw-on-volume-profile` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 12 | KWANT Profile Swing | `deep-profile-swing` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
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
  TypeScript passes. Production build and visual QA remain the release gate.

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
