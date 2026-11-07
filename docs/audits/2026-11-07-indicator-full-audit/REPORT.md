# Charts indicator audit — 7 November 2026

The offline catalogue/settings audit and the repairs below are complete. **This is not a declaration that every setting on every instrument has been proven in a live market.** Runtime input limits and remaining verification are explicit. No live gateway, terminal or provider subscription was restarted; no accounts, orders or user workspaces were modified. No new vendor polling or paid service was added.

## What was checked

- catalogueEntries: 124
- defaultSettings: 4313
- dialogEntries: 124
- dialogControlActions: 9588
- dropdownChoices: 2007
- dialogInteractionErrors: 0
- renderedCatalogueEntries: 124
- renderConsoleErrors: 0
- ownedFutures: 53
- ownedOhlcvChecks: 34874
- ownedNonemptyCalculations: 27110
- semanticSettingChecks: 571
- observedSettingEffects: 541
- dedicatedSuitesPassed: 101
- dedicatedSuitesFailed: 22
- baselineReproducedFailures: 22
- liveSessionVerified: false

- 53 futures × all 50 interval presets were exercised through the interval-builder contract; unsupported non-futures intervals are explicit outcomes, not passes.
- The matrix contains 125522 finite-output/replay-safety cases. Dedicated-model cases are labelled as requiring their separate model/renderer fixtures.
- Recorded-data checks used the existing read-only owned capture for futures trading session 2026-11-05. Of 34874 calculation cases, 27110 produced series; the rest require more history or additional execution/profile input. No invalid owned OHLCV or non-finite output was found.
- 24 targeted delivery, dependency, ownership and persistence tests pass; nine shared numeric-slider checks pass. Final isolated Next webpack build, TypeScript and page generation pass. Small edited modules pass scoped ESLint. The enormous Charts settings component was not counted as a full ESLint pass; prior attempts exhausted the lint heap.

## Findings

### F01 — fixed

A dedicated editor was followed by a second generated editor for the same setting, including repeated profile and order-flow toggles.

Dedicated setting ownership suppresses only the repeated generated controls. Slider plus matching numeric input remain one logical control. Catalogue IDs and legacy aliases are unique.

### F02 — fixed

Shared palette colour changes could save while useThemeColors continued to override them.

Selecting a custom colour disables theme mode and seeds sibling theme colours; the main editor uses one set of individual controls. Schemes disable individual controls and the theme toggle while they own the colours.

### F03 — fixed

Cumulative Delta Histogram exposed lineColor even though the later plot-colour pass overrode it.

Removed the redundant default/UI field. The main plot colour controls the line; bars/candles keep their separate Ask/Bid colours. Existing stored compatibility data is retained.

### F04 — fixed

Filtered-CVD, average/deviation, smoothing, regression and reversal inputs looked usable when their parent calculation was disabled.

Inactive controls show their actual dependency and disable until that mode/plot is active. Gated fixtures prove enabled filter/average/smoothing settings alter their intended output.

### F05 — fixed

Flattened settings fragments reused React child key .0, risking reused, omitted or duplicated controls across tab updates.

Section entries now retain unique hierarchical React identities. All 124 final rendered dialogs have zero console errors.

### D01 — unresolved input capability

The configured owned cash quote path supplies no traded volume or aggressor-side executions. All ten stock/ETF recordings captured in the preceding Volume audit contained volume 0; cash indices have no traded underlying volume. VXN is not on the configured live path. Price-only studies can use supplied OHLC. Volume, delta, footprint, tape and depth cannot be manufactured from quotes.

No replacement feed purchased, polling added, or missing data invented.

### V01 — unverified

Closed market: no live exchange session was observed for this audit.

Delivery hooks and execution coalescing were exercised with controlled events. This does not establish current exchange latency or continuous recording completeness.

### H01 — not established for every indicator

Owned minute aggregates do not reconstruct subminute execution paths, exact footprint rows or depth. Some generic calculations use a bounded lightweight history window.

All supported interval builders were tested with synthetic execution inputs; recorded OHLCV was checked separately. No provider history backfill or false completeness claim.

### T01 — pre-existing test debt

22 of 123 dedicated suites fail; all 22 reproduce on untouched HEAD. Three additional support-suite failures also reproduce there.

Documented exact results and reasons; did not alter functionality to satisfy obsolete source-string/theme/default assertions. The 8 ms computation budget failure remains a performance concern, not a waiver.

## Per-indicator tally

Every entry below was visited. “Dedicated” means the ordinary candle-series calculator is not its output path; inspect dedicated-suite-results.json and the per-setting evidence. No row is silently promoted to full live verification.

| # | Indicator | Category | Settings | UI checks | Dropdown choices | Calculation path | Live |
|---|---|---|---:|---:|---:|---|---|
| 1 | Big Blocks (Options) | Options Flow | 17 | 46 | 1 | Dedicated model / renderer | Unverified |
| 2 | Gamma Environment | Options Flow | 8 | 29 | 12 | Dedicated model / renderer | Unverified |
| 3 | Zero Gamma Line | Options Flow | 10 | 35 | 8 | Dedicated model / renderer | Unverified |
| 4 | Options Delta | Options Flow | 4 | 26 | 1 | Dedicated model / renderer | Unverified |
| 5 | Zero Gamma Bars | Options Flow | 4 | 26 | 1 | Dedicated model / renderer | Unverified |
| 6 | Gamma Heatmap | Options Flow | 19 | 44 | 24 | Dedicated model / renderer | Unverified |
| 7 | Net Gamma Exposure By Strike | Options Flow | 68 | 113 | 44 | Dedicated model / renderer | Unverified |
| 8 | GEX Interval Map | Options Flow | 79 | 134 | 65 | Dedicated model / renderer | Unverified |
| 9 | Bounce Levels | Options Flow | 109 | 175 | 36 | Dedicated model / renderer | Unverified |
| 10 | Dark Pool Map | Options Flow | 66 | 131 | 32 | Dedicated model / renderer | Unverified |
| 11 | Dark Pool (GEX) | Options Flow | 103 | 168 | 60 | Dedicated model / renderer | Unverified |
| 12 | Implied Volatility Rank | Options Flow | 38 | 69 | 23 | Dedicated model / renderer | Unverified |
| 13 | Cumulative Volume Delta | Order Flow | 26 | 51 | 11 | Common engine matrix | Unverified |
| 14 | CVD Divergence | Order Flow | 7 | 31 | 1 | Common engine matrix | Unverified |
| 15 | Pulling & Stacking | Order Flow | 87 | 163 | 21 | Dedicated model / renderer | Unverified |
| 16 | Delta Bar | Order Flow | 12 | 40 | 1 | Common engine matrix | Unverified |
| 17 | Delta % Highlight | Order Flow | 13 | 35 | 1 | Dedicated model / renderer | Unverified |
| 18 | Delta Cumulative Candlestick | Order Flow | 27 | 55 | 11 | Common engine matrix | Unverified |
| 19 | Delta Cumulative Histogram | Order Flow | 19 | 44 | 7 | Common engine matrix | Unverified |
| 20 | Imbalance Tracker | Order Flow | 26 | 57 | 1 | Dedicated model / renderer | Unverified |
| 21 | Imbalance Rejector | Order Flow | 14 | 40 | 1 | Dedicated model / renderer | Unverified |
| 22 | Unfinished Auction | Order Flow | 17 | 43 | 10 | Dedicated model / renderer | Unverified |
| 23 | Bar POC Indicator | Order Flow | 30 | 62 | 12 | Dedicated model / renderer | Unverified |
| 24 | Dynamic POC | Order Flow | 18 | 44 | 8 | Dedicated model / renderer | Unverified |
| 25 | Speed of Tape | Order Flow | 12 | 37 | 3 | Dedicated model / renderer | Unverified |
| 26 | Speed of Tape (Instant) | Order Flow | 20 | 48 | 7 | Dedicated model / renderer | Unverified |
| 27 | Volume/Delta Sprint | Order Flow | 18 | 44 | 9 | Common engine matrix | Unverified |
| 28 | Tape Speed & Order-Flow Burst | Order Flow | 54 | 101 | 18 | Dedicated model / renderer | Unverified |
| 29 | Big Contracts | Order Flow | 47 | 78 | 1 | Dedicated model / renderer | Unverified |
| 30 | Ratio Highlight | Order Flow | 8 | 31 | 4 | Dedicated model / renderer | Unverified |
| 31 | Stop Spotter | Order Flow | 38 | 72 | 19 | Dedicated model / renderer | Unverified |
| 32 | Auction Gap Tracker | Order Flow | 26 | 51 | 19 | Dedicated model / renderer | Unverified |
| 33 | Session Imbalance | Order Flow | 30 | 55 | 8 | Dedicated model / renderer | Unverified |
| 34 | Absorption Detector | Order Flow | 129 | 153 | 28 | Dedicated model / renderer | Unverified |
| 35 | Stacked Imbalance Suite | Order Flow | 53 | 87 | 22 | Dedicated model / renderer | Unverified |
| 36 | Iceberg / Refresh Detector | Order Flow | 93 | 107 | 15 | Dedicated model / renderer | Unverified |
| 37 | Liquidity Sweep / Stop Sweep Detector | Order Flow | 75 | 97 | 12 | Dedicated model / renderer | Unverified |
| 38 | POC & Auction Suite | Order Flow | 97 | 117 | 28 | Dedicated model / renderer | Unverified |
| 39 | Cumulative Iceberg/Stop | Order Flow | 22 | 49 | 6 | Dedicated model / renderer | Unverified |
| 40 | Book Speed | Order Flow | 17 | 43 | 3 | Dedicated model / renderer | Unverified |
| 41 | DOM Pro | Order Flow | 24 | 50 | 1 | Dedicated model / renderer | Unverified |
| 42 | Mini DOM | Order Flow | 13 | 40 | 1 | Dedicated model / renderer | Unverified |
| 43 | Footprint | Order Flow | 112 | 190 | 43 | Dedicated model / renderer | Unverified |
| 44 | KWANT Delta | Order Flow | 43 | 84 | 11 | Common engine matrix | Unverified |
| 45 | KWANT Wall | Order Flow | 19 | 49 | 7 | Dedicated model / renderer | Unverified |
| 46 | KWANT V-Tracker | Order Flow | 26 | 51 | 19 | Dedicated model / renderer | Unverified |
| 47 | Volume | Volume & Profiles | 3 | 12 | 1 | Common engine matrix | Unverified |
| 48 | Daily Volume Profile | Volume & Profiles | 97 | 318 | 63 | Dedicated model / renderer | Unverified |
| 49 | TPO Daily | Volume & Profiles | 181 | 256 | 84 | Dedicated model / renderer | Unverified |
| 50 | TPO Weekly | Volume & Profiles | 181 | 256 | 84 | Dedicated model / renderer | Unverified |
| 51 | Weekly Volume Profile | Volume & Profiles | 99 | 316 | 63 | Dedicated model / renderer | Unverified |
| 52 | Monthly Volume Profile | Volume & Profiles | 97 | 316 | 63 | Dedicated model / renderer | Unverified |
| 53 | Session Volume Profile | Volume & Profiles | 97 | 318 | 63 | Dedicated model / renderer | Unverified |
| 54 | Composite Volume Profile | Volume & Profiles | 102 | 320 | 70 | Dedicated model / renderer | Unverified |
| 55 | Visible Range Volume Profile | Volume & Profiles | 97 | 318 | 63 | Dedicated model / renderer | Unverified |
| 56 | Custom Draw-On Volume Profile | Volume & Profiles | 97 | 315 | 63 | Dedicated model / renderer | Unverified |
| 57 | Ask/Bid Volume Profile | Volume & Profiles | 97 | 318 | 63 | Dedicated model / renderer | Unverified |
| 58 | Delta Profile | Volume & Profiles | 97 | 316 | 63 | Dedicated model / renderer | Unverified |
| 59 | KWANT Profile Swing | Volume & Profiles | 41 | 81 | 22 | Dedicated model / renderer | Unverified |
| 60 | KWANT Profile Values | Volume & Profiles | 63 | 104 | 46 | Dedicated model / renderer | Unverified |
| 61 | TPO Levels | Volume & Profiles | 26 | 66 | 1 | Dedicated model / renderer | Unverified |
| 62 | VWAP | Volume & Profiles | 33 | 62 | 17 | Common engine matrix | Unverified |
| 63 | VWAP Envelopes | Volume & Profiles | 32 | 60 | 15 | Common engine matrix | Unverified |
| 64 | Rolling VWAP | Volume & Profiles | 32 | 60 | 16 | Common engine matrix | Unverified |
| 65 | Market Statistics | Volume & Profiles | 20 | 50 | 5 | Dedicated model / renderer | Unverified |
| 66 | On Candle Stats | Volume & Profiles | 40 | 66 | 9 | Dedicated model / renderer | Unverified |
| 67 | Important Levels | Market Structure | 45 | 67 | 12 | Common engine matrix | Unverified |
| 68 | Absolute Levels | Market Structure | 9 | 34 | 7 | Common engine matrix | Unverified |
| 69 | Pivot Points | Market Structure | 17 | 42 | 6 | Dedicated model / renderer | Unverified |
| 70 | Price Movement Levels | Market Structure | 20 | 52 | 14 | Common engine matrix | Unverified |
| 71 | FVG Identifier | Market Structure | 11 | 36 | 1 | Common engine matrix | Unverified |
| 72 | Gap Detector | Market Structure | 9 | 31 | 5 | Common engine matrix | Unverified |
| 73 | Divergence Detector | Market Structure | 20 | 48 | 1 | Dedicated model / renderer | Unverified |
| 74 | Confluence Identifier | Market Structure | 80 | 114 | 21 | Dedicated model / renderer | Unverified |
| 75 | Swing Point | Market Structure | 13 | 40 | 9 | Common engine matrix | Unverified |
| 76 | Average Daily Range Target | Market Structure | 7 | 30 | 6 | Dedicated model / renderer | Unverified |
| 77 | Sessions | Market Structure | 39 | 52 | 1 | Dedicated model / renderer | Unverified |
| 78 | Session Highs & Lows | Market Structure | 30 | 30 | 1 | Dedicated model / renderer | Unverified |
| 79 | IB Levels | Market Structure | 43 | 53 | 1 | Dedicated model / renderer | Unverified |
| 80 | Kwant Levels | Market Structure | 13 | 35 | 8 | Dedicated model / renderer | Unverified |
| 81 | Classic GEX Profile | Market Structure | 25 | 50 | 12 | Dedicated model / renderer | Unverified |
| 82 | Session Marker | Market Structure | 64 | 91 | 6 | Dedicated model / renderer | Unverified |
| 83 | Shift Candle | Market Structure | 26 | 57 | 8 | Dedicated model / renderer | Unverified |
| 84 | Moving Average | Trend | 2 | 24 | 1 | Common engine matrix | Unverified |
| 85 | Ichimoku Indicator | Trend | 39 | 67 | 13 | Common engine matrix | Unverified |
| 86 | Parabolic SAR | Trend | 10 | 34 | 7 | Common engine matrix | Unverified |
| 87 | Linear Regression | Trend | 10 | 33 | 12 | Common engine matrix | Unverified |
| 88 | Regression Channel | Trend | 22 | 54 | 14 | Common engine matrix | Unverified |
| 89 | Super Trend | Trend | 21 | 45 | 12 | Common engine matrix | Unverified |
| 90 | Super Trend Difference | Trend | 16 | 39 | 6 | Common engine matrix | Unverified |
| 91 | Keltner Channel | Trend | 6 | 30 | 1 | Common engine matrix | Unverified |
| 92 | Bollinger Bands | Trend | 5 | 28 | 1 | Common engine matrix | Unverified |
| 93 | Donchian Channel | Trend | 4 | 26 | 1 | Common engine matrix | Unverified |
| 94 | Tillson T3 | Trend | 12 | 36 | 14 | Common engine matrix | Unverified |
| 95 | Zig Zag | Trend | 19 | 45 | 7 | Common engine matrix | Unverified |
| 96 | Relative Strength Index (RSI) | Momentum | 2 | 24 | 1 | Common engine matrix | Unverified |
| 97 | Rate of Change (ROC) | Momentum | 2 | 24 | 1 | Common engine matrix | Unverified |
| 98 | MACD Indicator | Momentum | 6 | 30 | 1 | Common engine matrix | Unverified |
| 99 | Momentum Indicator | Momentum | 2 | 24 | 1 | Common engine matrix | Unverified |
| 100 | Commodity Channel Index (CCI) | Momentum | 2 | 24 | 1 | Common engine matrix | Unverified |
| 101 | Know Sure Thing (KST) | Momentum | 44 | 78 | 21 | Common engine matrix | Unverified |
| 102 | Inverse Cyber Cycle | Momentum | 31 | 60 | 13 | Common engine matrix | Unverified |
| 103 | Aroon Up/Down | Momentum | 3 | 25 | 1 | Common engine matrix | Unverified |
| 104 | Aroon Oscillator | Momentum | 2 | 24 | 1 | Common engine matrix | Unverified |
| 105 | Awesome Oscillator | Momentum | 3 | 26 | 1 | Common engine matrix | Unverified |
| 106 | Stochastic Oscillator | Momentum | 4 | 27 | 1 | Common engine matrix | Unverified |
| 107 | Williams %R | Momentum | 2 | 24 | 1 | Common engine matrix | Unverified |
| 108 | Chaikin Accumulation/Distribution | Momentum | 1 | 22 | 1 | Common engine matrix | Unverified |
| 109 | Average Directional Index (ADX) | Momentum | 9 | 32 | 4 | Common engine matrix | Unverified |
| 110 | VIX Environment | Volatility | 19 | 44 | 10 | Dedicated model / renderer | Unverified |
| 111 | Standard Deviation | Volatility | 2 | 24 | 1 | Common engine matrix | Unverified |
| 112 | Average True Range (ATR) | Volatility | 2 | 24 | 1 | Common engine matrix | Unverified |
| 113 | Expected Move | Volatility | 10 | 32 | 5 | Dedicated model / renderer | Unverified |
| 114 | Overlay Chart | Overlays | 17 | 41 | 6 | Dedicated model / renderer | Unverified |
| 115 | Overlay Symbol | Overlays | 17 | 40 | 6 | Dedicated model / renderer | Unverified |
| 116 | Overlay Timeframe Candlestick | Overlays | 11 | 33 | 1 | Dedicated model / renderer | Unverified |
| 117 | Overlay Timeframe Highlight | Overlays | 30 | 60 | 9 | Common engine matrix | Unverified |
| 118 | Text on Chart | Overlays | 5 | 27 | 1 | Common engine matrix | Unverified |
| 119 | Source Code Indicator | Overlays | 0 | 8 | 1 | Dedicated model / renderer | Unverified |
| 120 | KWANT Stats | KWANT Systems | 37 | 90 | 32 | Dedicated model / renderer | Unverified |
| 121 | Hedge Levels | KWANT Systems | 5 | 14 | 1 | Dedicated model / renderer | Unverified |
| 122 | KWANT-M IVB | KWANT Systems | 17 | 41 | 4 | Dedicated model / renderer | Unverified |
| 123 | KWANT Pattern Builder | KWANT Systems | 34 | 66 | 121 | Dedicated model / renderer | Unverified |
| 124 | Big Blocks | KWANT Systems | 28 | 54 | 1 | Dedicated model / renderer | Unverified |

## Evidence and reproduction

- results.json: complete per-tool counts and capability outcomes.
- CHECKLIST.md and controls.json.gz: every default setting, control evidence and runtime-reference inventory. A source reference alone is not an effect test.
- semantic-mutations.json: 571 setting probes across minute/hour fixtures, with relevant colour/filter/average modes activated. 541 effects were observed; remaining cases are renderer/data/event gated, not automatically dead.
- final-dialog-interactions.json.gz: full per-tool interaction evidence, including each dropdown option.
- final-rendered-inventory.json.gz: final-source UI control inventory; zero console errors across all 124 entries.
- final-supplemental-interactions.json.gz: focused retests of the last duplicate, date/time and section-identity repairs.
- matrix-cells.ndjson.gz: all instrument/preset outcomes; matrix-progress.json is the readable per-tool aggregate.
- owned-recording-checks.ndjson.gz and owned-recording-summary.json: owned minute-aggregate checks without publishing raw paid tape.
- dedicated-suite-results.json, test-failure-baseline.json and TEST-TRIAGE.md: exact passing/failing suite results and baseline evidence.
- gamma-settings-single-controls.png and cvd-filter-dependency.png: actual isolated component screenshots; these are not screenshots of the owner’s live workspace.

Run node --import ./scripts/alias-hook.mjs --test tests/indicator-settings-ownership.test.mjs tests/indicator-setting-availability.test.mjs tests/all-indicators-live-input.test.mjs tests/live-delta-panes.test.mjs tests/indicator-palette-persistence.test.mjs. Run node scripts/audits/generate-indicator-dedicated-control-keys.mjs --check to detect ownership metadata drift. The full React audit uses scripts/audits/build-indicator-full-audit.cjs plus audit-indicator-full-controls.cjs; see their AUDIT_VARIANT/AUDIT_BUNDLE options. No network is allowed by that worker.

The owned-recording script requires the local read-only capture tmp/volume-owned-recording-data.json. It does not call provider history. Intermediate before/after audit files remain local; only the final consolidated evidence is intended for the release.

## Release

Scoped production changes are limited to settings ownership, palette control, disabled-state explanations and React section identities. Provider data, indicator signal algorithms and recording policies were not changed. Deployment receipt is written locally after the single authorised main-only Git deployment.

The first Git deployment (9f67b75d) failed because the new isolated browser fixture inferred an overly narrow React state type. The initial isolated build had included the six production files but omitted that new fixture. The fixture now explicitly uses ChartIndicatorInstance[]; the complete TypeScript inputs and production webpack build pass. The correction changes audit-fixture typing only. The previous production deployment remained active during the failed build.
