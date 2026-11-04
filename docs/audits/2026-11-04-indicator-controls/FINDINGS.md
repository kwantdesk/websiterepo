# Indicator control audit results

Updated 2026-11-04T04:45:35.021Z. The catalogue/settings audit covers all 124 registered indicators. This report separates control wiring from live chart and provider accuracy.

## Verified scope

- 4,302 default settings inventoried in the requested category order.
- 10,230 interactions against actual React settings components in isolated JSDOM, including nested profile tabs, colour pickers, switches, numeric inputs/sliders, linked GEX settings and action buttons. No interaction exceptions. These are interaction counts, including repeated shared controls, not distinct setting counts.
- 122 public study cards pass Add → disable → enable → remove. The custom draw-on profile arms the real drawing-placement event. The saved-script adapter is intentionally absent from the public library.
- All 124 pass Save, Close, JSON restore and reopen checks.
- 2,072 offered dropdown choices exercised across 124 studies; selected defaults are recorded separately from changes.
- 2,397 boolean/numeric normalization probes; the three intentional constraints are listed below.
- 1,488 catalogue × gradient save/restore checks and 669 colour override checks pass.
- 49 common-candle calculators produced output; 340 setting mutations changed it. The other studies use separate primitives, depth, executions, profiles or options data. No generic calculator exceptions.
- All 11 authoritative data-fixture suites, 31 targeted behavioral tests and nine existing numeric-slider checks pass.
- Full production build passed. Standard scoped lint has zero errors; optional React Compiler analysis exhausted memory on the existing large components and was excluded from the scoped invocation. The 138 warnings remain recorded.

## Fixes

### F001 · Gamma Heatmap

The setting was persisted but the status banner rendered unconditionally.

The banner now obeys showStatus.

Verification: fixed; source and regression checks.

### F002 · Dark Pool (GEX)

The switch was never read. Only combined confluence thresholds could produce a new-print alert.

New-print alerts obey their switch and minimum print notional independently.

Verification: fixed; source traced.

### F003 · Dark Pool (GEX)

The switch was never read.

GEX confluence alerts now require this switch, actual confluence and the configured thresholds.

Verification: fixed; source traced.

### F004 · Shared indicator alert delivery

Many indicators dispatched browser events without a receiver that displayed or played them.

A scoped receiver delivers events only to their enabled chart instance and instrument. Replay is muted. Explicit popup/sound choices are honored. Duplicate messages are suppressed. SuperTrend retains its existing delivery.

Verification: fixed; behavioral hook tests.

### F005 · GEX Interval Map, Bounce Levels, Dark Pool Map, Dark Pool (GEX)

Their alert events used channels without visible in-chart delivery.

They now also dispatch to the common chart alert delivery path.

Verification: fixed; source traced.

### F006 · Imbalance Tracker

The alert controls were persisted but no producer consumed them.

New current-bar zones with recent executions can emit the selected sound/popup with the configured text. Existing zones are seeded without historical alerts.

Verification: fixed; source traced; live trigger verification pending.

### F007 · Big Contracts

The sound toggle was not consumed.

Fresh qualifying live executions emit sound once per print identity. Archive prints and replay remain silent.

Verification: fixed; source traced; live trigger verification pending.

### F008 · Generated settings controls

Internal migration/selection flags were eligible for generic visible checkboxes.

These internal fields are excluded from generated user controls.

Verification: fixed; source traced.

### F009 · Sessions

The generic checkbox was exposed and persisted, but the session renderer had no midpoint path.

showMidline paints exactly the high/low arithmetic midpoint through the chart price coordinate transform and obeys on/off.

Verification: implemented; actual midpoint renderer test passes.

### F010 · Big Blocks

No alert producer currently consumes these settings. The chart study itself has a separate live state machine.

Big Blocks emits the selected message/sound on fresh live directional-bias transitions, seeds historical state silently, ignores older bars and replay, and suppresses repeated direction alerts within a bar.

Verification: implemented; actual producer transition/replay/deduplication tests pass.

### F011 · Bounce Levels

This toggle is saved and exposed but no renderer consumes it.

Observed live Bounce alert events can draw dots in chart time/price coordinates. Toggle off clears them even when the exposure raster is cached. This does not manufacture retrospective alert events or a saved marker archive.

Verification: implemented; renderer coordinate/cache tests pass.

### F012 · DOM Pro

Literal runtime reads are absent; current DOM columns have a separate domColumns contract.

Generic order-count, pull/stack and recent-trade switches now control the actual domColumns contract. Cumulative displays true outward depth sums without changing raw book quantities. Last-trade colour reaches its renderer when theme colours are off.

Verification: implemented; state/column and cumulative-book tests pass; authoritative DOM fixture passes.

### F013 · Shared indicator palettes

Study-specific settings whitelists discarded the shared gradient selection on Save or workspace restore.

Validate and retain shared palette presentation state outside study-input whitelists. Invalid scheme values fall back to Off.

Verification: fixed; all 1,488 catalogue × gradient save/restore combinations pass.

### F014 · KWANT Delta

The numeric settings normalizer reset user-selected colours back to defaults.

Retain validated hex overrides for declared colours alongside normalized calculation inputs.

Verification: fixed; save/restore and populated output-series test passes.

### F015 · Stop Spotter / Inverse Cyber Cycle / shared colour discovery

Settings ending in Color were treated as paint colours even when their values were modes such as none/direction.

Discover colour pickers only from actual colour values; schemes no longer replace mode selections with hex strings.

Verification: fixed; colour-role and mode-preservation tests pass.

### F016 · Pulling & Stacking

Clickable checkboxes were normalized back to false without explaining that the current pipeline does not support these filters.

Disable and label these filters. Do not invent ownership or implied-order classifications. Implementing the feature requires end-to-end tagged depth support.

Verification: unsupported capability now labelled and disabled; targeted dialog checks pass.

### F017 · Volume profiles / TPO / GEX Interval Map

Some template actions accepted clicks while missing the required name or selected saved template, then returned without feedback.

Save new requires a nonempty name; Delete template requires a matching saved template. Applicable actions remain enabled.

Verification: fixed; targeted checks cover all nine profile variants and both TPO variants.

### F018 · Absolute Levels / shared numeric controls

A tiny edit measured from a billion-point minimum exceeded integer precision and could round back to zero.

Use a local zero-based step grid only when the distant minimum would exceed safe integer precision; preserve ordinary minimum-anchored slider grids.

Verification: fixed; precision/bounds tests and actual dialog saves pass.

## Limits and work still open

- **Live chart sign-off:** this pass does not certify every setting’s live market drawing, alert timing, replay reconstruction or vendor parity. It does not claim that a JSON change proves a correctly drawn chart. No production feeds or subscriptions were restarted for testing.
- **Conditional combinations:** all default dialog pages and discovered expandable panels were traversed. Disabled/conditional fields and mode combinations are not an exhaustive combinatorial live test. Their saved inputs are separately probed; remaining data-dependent paths need their own recorded fixtures/session evidence.
- **Pulling & Stacking own/implied filters:** unsupported by the current depth pipeline; now clearly disabled. Implementing them requires tagged input support and a corresponding calculation contract. No ownership/implied classifications are fabricated.
- **Bounce alert dots:** observed live alerts can draw anchored dots. Retrospective alert-event history, reload persistence and replay reconstruction are not implemented by this change.
- **Ichimoku performance:** the 20,000-bar benchmark repeated at 8.18ms against its 8ms budget. This remains an open measured performance item; history was not silently shortened.
- **Existing suite maintenance:** 55 of the initial 237 commands failed. Every failure is retained and classified in TEST-FAILURE-TRIAGE.md; regex/source-shape failures, removed-theme fixtures and runner errors are not automatically live product defects, and are not relabelled as passes.
- **Template helper fields:** naming a preset/template changes its form state, not the indicator’s settings until Save new/Save template. Import opens a file chooser; parsing, wrong-study rejection and storage failures are covered by the existing template suite. The OS file chooser is not exercised by JSDOM.

## Input constraints

- Pulling & Stacking includeOwnOrders/includeImpliedOrders remain false because the pipeline does not support the filters. The dialog now reflects this limit.
- KWANT Delta range4Maximum=1 is constrained to 31 when its minimum is 31. Zero retains its documented unlimited-maximum meaning.

## Per-indicator evidence

| Category | Indicator | Dialog interactions | Save/close/reopen | Add/remove | Calculation path |
| --- | --- | ---: | --- | --- | --- |
| Options Flow | Big Blocks (Options) | 48 | passed | passed | dedicated renderer / additional data |
| Options Flow | Gamma Environment | 34 | passed | passed | dedicated renderer / additional data |
| Options Flow | Zero Gamma Line | 36 | passed | passed | dedicated renderer / additional data |
| Options Flow | Options Delta | 28 | passed | passed | dedicated renderer / additional data |
| Options Flow | Zero Gamma Bars | 28 | passed | passed | dedicated renderer / additional data |
| Options Flow | Gamma Heatmap | 47 | passed | passed | dedicated renderer / additional data |
| Options Flow | Net Gamma Exposure By Strike | 120 | passed | passed | dedicated renderer / additional data |
| Options Flow | GEX Interval Map | 144 | passed | passed | dedicated renderer / additional data |
| Options Flow | Bounce Levels | 96 | passed | passed | dedicated renderer / additional data |
| Options Flow | Dark Pool Map | 136 | passed | passed | dedicated renderer / additional data |
| Options Flow | Dark Pool (GEX) | 171 | passed | passed | dedicated renderer / additional data |
| Options Flow | Implied Volatility Rank | 89 | passed | passed | dedicated renderer / additional data |
| Order Flow | Cumulative Volume Delta | 59 | passed | passed | common calculator exercised |
| Order Flow | CVD Divergence | 34 | passed | passed | common calculator exercised |
| Order Flow | Pulling & Stacking | 188 | passed | passed | dedicated renderer / additional data |
| Order Flow | Delta Bar | 46 | passed | passed | common calculator exercised |
| Order Flow | Delta % Highlight | 37 | passed | passed | dedicated renderer / additional data |
| Order Flow | Delta Cumulative Candlestick | 61 | passed | passed | common calculator exercised |
| Order Flow | Delta Cumulative Histogram | 50 | passed | passed | common calculator exercised |
| Order Flow | Imbalance Tracker | 66 | passed | passed | dedicated renderer / additional data |
| Order Flow | Imbalance Rejector | 42 | passed | passed | dedicated renderer / additional data |
| Order Flow | Unfinished Auction | 45 | passed | passed | dedicated renderer / additional data |
| Order Flow | Bar POC Indicator | 65 | passed | passed | dedicated renderer / additional data |
| Order Flow | Dynamic POC | 48 | passed | passed | dedicated renderer / additional data |
| Order Flow | Speed of Tape | 41 | passed | passed | dedicated renderer / additional data |
| Order Flow | Speed of Tape (Instant) | 53 | passed | passed | dedicated renderer / additional data |
| Order Flow | Volume/Delta Sprint | 48 | passed | passed | common calculator exercised |
| Order Flow | Tape Speed & Order-Flow Burst | 111 | passed | passed | dedicated renderer / additional data |
| Order Flow | Big Contracts | 80 | passed | passed | dedicated renderer / additional data |
| Order Flow | Ratio Highlight | 33 | passed | passed | dedicated renderer / additional data |
| Order Flow | Stop Spotter | 77 | passed | passed | dedicated renderer / additional data |
| Order Flow | Auction Gap Tracker | 55 | passed | passed | dedicated renderer / additional data |
| Order Flow | Session Imbalance | 60 | passed | passed | dedicated renderer / additional data |
| Order Flow | Absorption Detector | 161 | passed | passed | dedicated renderer / additional data |
| Order Flow | Stacked Imbalance Suite | 91 | passed | passed | dedicated renderer / additional data |
| Order Flow | Iceberg / Refresh Detector | 114 | passed | passed | dedicated renderer / additional data |
| Order Flow | Liquidity Sweep / Stop Sweep Detector | 104 | passed | passed | dedicated renderer / additional data |
| Order Flow | POC & Auction Suite | 125 | passed | passed | dedicated renderer / additional data |
| Order Flow | Cumulative Iceberg/Stop | 60 | passed | passed | dedicated renderer / additional data |
| Order Flow | Book Speed | 51 | passed | passed | dedicated renderer / additional data |
| Order Flow | DOM Pro | 53 | passed | passed | dedicated renderer / additional data |
| Order Flow | Mini DOM | 47 | passed | passed | dedicated renderer / additional data |
| Order Flow | Footprint | 205 | passed | passed | dedicated renderer / additional data |
| Order Flow | KWANT Delta | 100 | passed | passed | common calculator exercised |
| Order Flow | KWANT Wall | 53 | passed | passed | dedicated renderer / additional data |
| Order Flow | KWANT V-Tracker | 63 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | Volume | 28 | passed | passed | common calculator exercised |
| Volume & Profiles | Daily Volume Profile | 337 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | TPO Daily | 257 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | TPO Weekly | 251 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | Weekly Volume Profile | 337 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | Monthly Volume Profile | 337 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | Session Volume Profile | 337 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | Composite Volume Profile | 339 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | Visible Range Volume Profile | 337 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | Custom Draw-On Volume Profile | 334 | passed | drawing placement armed | dedicated renderer / additional data |
| Volume & Profiles | Ask/Bid Volume Profile | 337 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | Delta Profile | 337 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | KWANT Profile Swing | 87 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | KWANT Profile Values | 113 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | TPO Levels | 69 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | VWAP | 73 | passed | passed | common calculator exercised |
| Volume & Profiles | VWAP Envelopes | 71 | passed | passed | common calculator exercised |
| Volume & Profiles | Rolling VWAP | 71 | passed | passed | common calculator exercised |
| Volume & Profiles | Market Statistics | 54 | passed | passed | dedicated renderer / additional data |
| Volume & Profiles | On Candle Stats | 71 | passed | passed | dedicated renderer / additional data |
| Market Structure | Important Levels | 75 | passed | passed | common calculator exercised |
| Market Structure | Absolute Levels | 36 | passed | passed | common calculator exercised |
| Market Structure | Pivot Points | 47 | passed | passed | common calculator exercised |
| Market Structure | Price Movement Levels | 36 | passed | passed | common calculator exercised |
| Market Structure | FVG Identifier | 38 | passed | passed | common calculator exercised |
| Market Structure | Gap Detector | 33 | passed | passed | common calculator exercised |
| Market Structure | Divergence Detector | 50 | passed | passed | dedicated renderer / additional data |
| Market Structure | Confluence Identifier | 128 | passed | passed | dedicated renderer / additional data |
| Market Structure | Swing Point | 30 | passed | passed | common calculator exercised |
| Market Structure | Average Daily Range Target | 32 | passed | passed | common calculator exercised |
| Market Structure | Sessions | 56 | passed | passed | dedicated renderer / additional data |
| Market Structure | Session Highs & Lows | 30 | passed | passed | dedicated renderer / additional data |
| Market Structure | IB Levels | 60 | passed | passed | dedicated renderer / additional data |
| Market Structure | Kwant Levels | 39 | passed | passed | dedicated renderer / additional data |
| Market Structure | Classic GEX Profile | 53 | passed | passed | dedicated renderer / additional data |
| Market Structure | Session Marker | 124 | passed | passed | dedicated renderer / additional data |
| Market Structure | Shift Candle | 61 | passed | passed | dedicated renderer / additional data |
| Trend | Moving Average | 25 | passed | passed | common calculator exercised |
| Trend | Ichimoku Indicator | 74 | passed | passed | common calculator exercised |
| Trend | Parabolic SAR | 36 | passed | passed | common calculator exercised |
| Trend | Linear Regression | 35 | passed | passed | common calculator exercised |
| Trend | Regression Channel | 35 | passed | passed | common calculator exercised |
| Trend | Super Trend | 47 | passed | passed | common calculator exercised |
| Trend | Super Trend Difference | 41 | passed | passed | common calculator exercised |
| Trend | Keltner Channel | 33 | passed | passed | common calculator exercised |
| Trend | Bollinger Bands | 31 | passed | passed | common calculator exercised |
| Trend | Donchian Channel | 29 | passed | passed | common calculator exercised |
| Trend | Tillson T3 | 38 | passed | passed | common calculator exercised |
| Trend | Zig Zag | 50 | passed | passed | common calculator exercised |
| Momentum | Relative Strength Index (RSI) | 25 | passed | passed | common calculator exercised |
| Momentum | Rate of Change (ROC) | 25 | passed | passed | common calculator exercised |
| Momentum | MACD Indicator | 33 | passed | passed | common calculator exercised |
| Momentum | Momentum Indicator | 25 | passed | passed | common calculator exercised |
| Momentum | Commodity Channel Index (CCI) | 25 | passed | passed | common calculator exercised |
| Momentum | Know Sure Thing (KST) | 83 | passed | passed | common calculator exercised |
| Momentum | Inverse Cyber Cycle | 67 | passed | passed | common calculator exercised |
| Momentum | Aroon Up/Down | 27 | passed | passed | common calculator exercised |
| Momentum | Aroon Oscillator | 25 | passed | passed | common calculator exercised |
| Momentum | Awesome Oscillator | 27 | passed | passed | common calculator exercised |
| Momentum | Stochastic Oscillator | 29 | passed | passed | common calculator exercised |
| Momentum | Williams %R | 25 | passed | passed | common calculator exercised |
| Momentum | Chaikin Accumulation/Distribution | 23 | passed | passed | common calculator exercised |
| Momentum | Average Directional Index (ADX) | 35 | passed | passed | common calculator exercised |
| Volatility | VIX Environment | 60 | passed | passed | dedicated renderer / additional data |
| Volatility | Standard Deviation | 25 | passed | passed | common calculator exercised |
| Volatility | Average True Range (ATR) | 25 | passed | passed | common calculator exercised |
| Volatility | Expected Move | 33 | passed | passed | dedicated renderer / additional data |
| Overlays | Overlay Chart | 49 | passed | passed | dedicated renderer / additional data |
| Overlays | Overlay Symbol | 48 | passed | passed | dedicated renderer / additional data |
| Overlays | Overlay Timeframe Candlestick | 37 | passed | passed | dedicated renderer / additional data |
| Overlays | Overlay Timeframe Highlight | 68 | passed | passed | common calculator exercised |
| Overlays | Text on Chart | 29 | passed | passed | common calculator exercised |
| Overlays | Source Code Indicator | 8 | passed | internal saved-script adapter; intentionally absent from library | dedicated renderer / additional data |
| KWANT Systems | KWANT Stats | 95 | passed | passed | dedicated renderer / additional data |
| KWANT Systems | Hedge Levels | 14 | passed | passed | dedicated renderer / additional data |
| KWANT Systems | KWANT-M IVB | 51 | passed | passed | dedicated renderer / additional data |
| KWANT Systems | KWANT Pattern Builder | 74 | passed | passed | dedicated renderer / additional data |
| KWANT Systems | Big Blocks | 58 | passed | passed | dedicated renderer / additional data |

Machine-readable control-level evidence: dialog-interactions-consolidated.json. Original setting inventory: controls.json. The inventory CHECKLIST.md is retained as an end-to-end chart sign-off list; its unchecked live/render requirements are not implicitly signed off by these settings tests.
