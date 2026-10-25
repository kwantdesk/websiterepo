# Replay indicator lookahead audit — 2026-10-25

## Scope and evidence

All127 registered indicators enumerated below in catalogue order, each with a
named regression in tests/replay-indicator-causality.test.mjs.46 default engine
outputs plus a non-empty custom Pine fixture are tested numerically against
poisoned future tails and backward prefixes.60 dedicated adapters are covered
by shared Chart input/availability guards and targeted adapter/engine tests;
empty generic-engine results are NOT claimed as dedicated visual verification.
20 current-only/unverified-source studies are unavailable during replay. Their
saved/live settings are preserved, with a derived replay availability notice.

This is a source/data-boundary causality audit, not a certification of every
indicator setting, provider revision/publication time, or signed-in visual
combination. No new archive data, vendor publication timestamps or historical
coverage is invented. Missing/unverifiable source data remains unavailable.
Known-at-clock level projections are not future observations; future-dated
series/Ichimoku cloud vertices are clipped in replay.

## Confirmed defects repaired

- Indicator live sampling could retain a later frame after rewinding. Replay
  now consumes current clipped candles/exact trades synchronously.19 frame
  summaries and retained tooltips carry source clock/instrument/timeframe.
- Profile acceptance allowed one HOUR of future coverage. Removed tolerance;
  native/owned profiles are checked again at render time.
- Gamma Heatmap rounded cutoff UP to candle close. Exact cutoff now requires
  completed source minute and an already-known mapping. GEX Interval Map
  clips before normalization/levels and uses prior-only display-price mapping.
- Options Delta/Zero Gamma Bars use completed minute frames; Zero Gamma never
  interpolates toward a later observation during replay. Historical minute
  trails wait for minute close; actual LIVE/EOD snapshot timestamps stay exact.
- Live-only adapters were blocked only in Charts, not Backtesting. Shared
  Chart/engine policy now protects both. No current-book substitution.
- Big/Deep Contracts unions retained future markers. Entering replay/rewinding
  rebuilds from the exact prefix; forward ticks retain only already-observed
  events. Stacked Imbalance/POC engines reset on rewind/entry/scope changes,
  preserving causal forward lifecycle state. TPO bypasses live cache/throttle/
  developing-only reuse.
- Backtesting second OHLC included the unfinished current second and could
  borrow an unopened candle's open. It now waits for completed seconds and
  uses no synthetic open. Event bars require a known end/next-bar boundary.
- UTC flooring could call CME daily bars complete hours early. Actual archived
  bar opens govern completion in both replay entry points.
- Same-day daily VIX OHLC and retained live fields leaked EOD/current knowledge.
  Replay now labels and uses completed prior-day history only, not intraday VIX.
- Independent Instant Tape listener still accepted live events during replay;
  it is disconnected and replay uses its direct causal prop, not live state.
- Dark Pool price-reaction memo could retain a later forming candle; replay
  refreshes samples at its clock and rejects mappings learned after it.
- Backtest strategy callbacks received full future candles/indicator arrays.
  Read-only prefix views now hide future indexing, length, iteration and
  descriptors without quadratic history copies. This is not a JS security sandbox.

## One-by-one registry record

| Indicator | Replay control / evidence |
| --- | --- |
| Big Blocks (Options) (`big-blocks-options`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Gamma Environment (`gamma-environment`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| VIX Environment (`vix-environment`) | Completed daily history only; reject same-day final bars/live state |
| Zero Gamma Line (`zero-gamma-line`) | Completed historical minutes; no interpolation toward later readings |
| Options Delta (`options-delta`) | Completed-minute frame totals only |
| Zero Gamma Bars (`zero-gamma-bars`) | Completed-minute frame totals only |
| Gamma Heatmap (`gamma-heatmap`) | Exact clock; completed minute + mapping availability guard |
| Net Gamma Exposure By Strike (`net-gamma-exposure-by-strike`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| GEX Interval Map (`gex-interval-map`) | Completed buckets before model; prior-only display mapping |
| Bounce Levels (`bounce-levels`) | Point-in-time snapshot/head/checkpoint clipping |
| Dark Pool Map (`dark-pool-map`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Dark Pool (GEX) (`dark-pool-gex`) | Observable prints + mapping availability; replay price samples refresh |
| Implied Volatility Rank (`implied-volatility-rank`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Cumulative Volume Delta (`cumulative-volume-delta`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| CVD Divergence (`cvd-divergence`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Pulling & Stacking (`pulling-stacking`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Delta Bar (`delta-bar`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Delta % Highlight (`delta-highlight`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Delta Cumulative Candlestick (`delta-cumulative-candlestick`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Delta Cumulative Histogram (`delta-cumulative-histogram`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Imbalance Tracker (`imbalance-tracker`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Imbalance Rejector (`imbalance-rejector`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Unfinished Auction (`unfinished-auction`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Bar POC Indicator (`bar-poc-indicator`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Dynamic POC (`dynamic-poc`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Speed of Tape (`speed-of-tape`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Speed of Tape (Instant) (`speed-of-tape-instant`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Volume/Delta Sprint (`volume-delta-sprint`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Tape Speed & Order-Flow Burst (`tape-speed-order-flow-burst`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Big Contracts (`big-trades`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Ratio Highlight (`ratio-highlight`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Stop Spotter (`stop-spotter`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Auction Gap Tracker (`auction-gap-tracker`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Session Imbalance (`session-imbalance`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Absorption Detector (`absorption-detector`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Stacked Imbalance Suite (`stacked-imbalance-suite`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Iceberg / Refresh Detector (`iceberg-refresh-detector`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Liquidity Sweep / Stop Sweep Detector (`liquidity-stop-sweep-detector`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| POC & Auction Suite (`poc-auction-suite`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Cumulative Iceberg/Stop (`cumulative-iceberg-stop`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Book Speed (`book-speed`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| DOM Pro (`depth-of-market`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Mini DOM (`mini-dom`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Footprint (`deep-print-footprint`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| KWANT Delta (`deep-delta`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| KWANT Wall (`deep-wall`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| KWANT V-Tracker (`deep-v-tracker`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Volume (`volume`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Daily Volume Profile (`kwant-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| TPO Daily (`tpo-chart`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| TPO Weekly (`weekly-tpo`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Weekly Volume Profile (`weekly-volume-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Monthly Volume Profile (`monthly-volume-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Session Volume Profile (`session-volume-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Composite Volume Profile (`composite-volume-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Visible Range Volume Profile (`visible-range-volume-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Custom Draw-On Volume Profile (`custom-draw-on-volume-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Ask/Bid Volume Profile (`ask-bid-volume-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Delta Profile (`delta-profile`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| KWANT Profile Swing (`deep-profile-swing`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| KWANT Profile Values (`deep-profile-values`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| TPO Levels (`tpo-levels`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| VWAP (`vwap`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| VWAP Envelopes (`vwap-envelopes`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Anchored VWAP (`anchored-vwap`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Rolling VWAP (`rolling-vwap`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Market Statistics (`market-statistics`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| On Candle Stats (`on-candle-stats`) | Dedicated profile/TPO adapter: causal tape, zero future tolerance, rewind/cache guards |
| Important Levels (`important-levels`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Absolute Levels (`absolute-levels`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Pivot Points (`pivot-points`) | Dedicated session/structure adapter: causal candle/minute prefix |
| Price Movement Levels (`price-movement-levels`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| FVG Identifier (`fvg-identifier`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Gap Detector (`gap-detector`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Divergence Detector (`divergence-detector`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Confluence Identifier (`confluence-identifier`) | Dedicated session/structure adapter: causal candle/minute prefix |
| Swing Point (`swing-point`) | Dedicated session/structure adapter: causal candle/minute prefix |
| Average Daily Range Target (`average-daily-range-target`) | Dedicated session/structure adapter: causal candle/minute prefix |
| Sessions (`sessions`) | Dedicated session/structure adapter: causal candle/minute prefix |
| Session Highs & Lows (`session-highs-lows`) | Dedicated session/structure adapter: causal candle/minute prefix |
| IB Levels (`ib-levels`) | Dedicated session/structure adapter: causal candle/minute prefix |
| Kwant Levels (`gamma-levels`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Classic GEX Profile (`classic-gex-profile`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Session Marker (`session-marker`) | Dedicated session/structure adapter: causal candle/minute prefix |
| Shift Candle (`shift-candle`) | Dedicated session/structure adapter: causal candle/minute prefix |
| Moving Average (`moving-average`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Ichimoku Indicator (`ichimoku-indicator`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Parabolic SAR (`parabolic-sar`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Linear Regression (`linear-regression`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Regression Channel (`regression-channel`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Super Trend (`super-trend`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Super Trend Difference (`super-trend-difference`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Keltner Channel (`keltner-channel`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Bollinger Bands (`bollinger-bands`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Donchian Channel (`donchian-channel`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Tillson T3 (`tillson-t3`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Zig Zag (`zig-zag`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Relative Strength Index (RSI) (`relative-strength-index-rsi`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Rate of Change (ROC) (`rate-of-change-roc`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| MACD Indicator (`macd-indicator`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Momentum Indicator (`momentum-indicator`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Commodity Channel Index (CCI) (`commodity-channel-index-cci`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Know Sure Thing (KST) (`know-sure-thing-kst`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Inverse Cyber Cycle (`inverse-cyber-cycle`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Aroon Up/Down (`aroon-up-down`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Aroon Oscillator (`aroon-oscillator`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Awesome Oscillator (`awesome-oscillator`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Stochastic Oscillator (`stochastic-oscillator`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Williams %R (`williams-r`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Chaikin Accumulation/Distribution (`chaikin-accumulation-distribution`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Average Directional Index (ADX) (`average-directional-index-adx`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Standard Deviation (`standard-deviation`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Average True Range (ATR) (`average-true-range-atr`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Expected Move (`expected-move`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Candlestick Bar (`candlestick-bar`) | Dedicated overlay adapter: causal primary candles / completed external bars |
| Overlay Chart (`overlay-chart`) | Dedicated overlay adapter: causal primary candles / completed external bars |
| Overlay Symbol (`overlay-symbol`) | Dedicated overlay adapter: causal primary candles / completed external bars |
| Overlay Timeframe Candlestick (`overlay-timeframe-candlestick`) | Dedicated overlay adapter: causal primary candles / completed external bars |
| Overlay Timeframe Highlight (`overlay-timeframe-highlight`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Annotations Overlay (`annotations-overlay`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| Text on Chart (`text-on-chart`) | Direct engine: future-tail poisoning + rewind prefix + output cutoff |
| Source Code Indicator (`source-code-indicator`) | Pine runtime prefix fixture; future inputs/output excluded |
| KWANT Stats (`kwant-stats`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Hedge Levels (`hedge-levels`) | UNAVAILABLE: no verified historical adapter; both replay entry points fail closed |
| KWANT-M IVB (`deep-m-ivb`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| KWANT Pattern Builder (`deep-pattern-builder`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |
| Big Blocks (`deep-m-effort-nq`) | Dedicated execution/Footprint adapter: synchronous prefix, scoped frame provenance, retained-state guards |

## Verification

- 252 focused and adjacent regressions pass, including the 127 named catalogue cases.
- Dedicated POC Auction, Stacked Imbalance, three-month Footprint replay, GEX Interval Map, Zero Gamma, replay volume profile and VIX scripts pass.
- Production build passes (84 pages); ESLint passes for the smaller changed modules.
- Chart.tsx lint exhausted both the default and 8 GB JavaScript heaps; no successful full Chart lint result is claimed. The production compiler/type check passes.
- Broader existing source-string assertions in dark-pool-map, big-trades-history and test-backtesting-big-contracts are stale; they are not counted in the passing focused suite.
- This is source-level causal-input, state-provenance and numeric regression verification, not signed-in visual acceptance of every settings combination or certification of provider publication timestamps. Unavailable historical studies fail closed; live behavior is preserved.

## Release

One scoped main deployment; production identity is recorded locally after READY verification.
