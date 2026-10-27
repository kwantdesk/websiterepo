# ES indicator and profile audit — 2026-10-27

## Confirmed fault and fix

The native volume-profile renderer measured readability against the original one-tick source before multiplying the manual grouping. At 0.4 px per tick a manual four-tick ES row became eight ticks (2 points), although the requested one-point row was already readable. The shared resolver now assesses the requested row first. Automatic grouping and the 0.55 px legibility floor remain; zooming out may still necessarily aggregate subpixel rows. Source resolution and user settings are preserved.

Applies to native daily, weekly, session, monthly, visible-range, composite and custom/drawn profiles, including their volume, bid/ask and delta styles. It does not change liquidity-map BID/ASK percentage label aggregation.

## Evidence

- Regression failed before the fix (4 rows instead of 8) and passes after. ES quarter-point rows, all five modes and five styles across daily/weekly/custom models retain levels and volume when readable.
- Read-only VPS request returned HTTP 200, ESZ6, tickSize 0.25, groupTicks 1, 114 levels, minimum adjacent gap 0.25, totalVolume 117117. This is one captured response, not proof of full-session recording completeness.
- 112 focused tests pass: profile renderer/ownership/variants/boundary continuity, footprint, CVD, blocks/contracts, VWAP and session studies. The existing style matrix exercises 600 renderer combinations.
- Production build and scoped ESLint pass.
- Wider check: 87/94 tests passed; seven source-regex assertions in daily-volume-profile-live and volume-profile-session-availability also fail against HEAD baseline. Those pre-existing assertions were not rewritten to conceal failures.
- ES fixture: 2880 minute bars with quarter-tick OHLC and classified bid/ask executions; 2880 footprint bars checked. Dedicated swing profiles (12) and value profiles (3) produced tick-aligned ES results.
- Daily/weekly/composite/variant requests retain one-tick source grouping. Deep Effort has an explicit ES configuration separate from NQ; swing/value profiles use the supplied instrument and tick size.

## Full catalog calculation inventory

All 127 catalog entries have registered engines and renderers. 50 produced finite generic series on the fixture, with no calculation exceptions. The other 77 require a dedicated renderer, provider input, user configuration or a triggering signal; their empty generic output is explicitly NOT a successful live-data verification. The dedicated suites above cover selected shared paths, not every provider-backed study under live ES market conditions. No claim of universal live-indicator correctness is made.

Reproduce: node --import ./scripts/alias-hook.mjs scripts/audit-es-indicators.mjs (writes tmp/es-indicator-audit.json).

| Indicator | Generic ES series | Points | Result |
|---|---:|---:|---|
| Big Blocks (Options) | 0 | 0 | dedicated-path-or-no-signal |
| Gamma Environment | 0 | 0 | dedicated-path-or-no-signal |
| VIX Environment | 0 | 0 | dedicated-path-or-no-signal |
| Zero Gamma Line | 0 | 0 | dedicated-path-or-no-signal |
| Options Delta | 0 | 0 | dedicated-path-or-no-signal |
| Zero Gamma Bars | 0 | 0 | dedicated-path-or-no-signal |
| Gamma Heatmap | 0 | 0 | dedicated-path-or-no-signal |
| Net Gamma Exposure By Strike | 0 | 0 | dedicated-path-or-no-signal |
| GEX Interval Map | 0 | 0 | dedicated-path-or-no-signal |
| Bounce Levels | 0 | 0 | dedicated-path-or-no-signal |
| Dark Pool Map | 0 | 0 | dedicated-path-or-no-signal |
| Dark Pool (GEX) | 0 | 0 | dedicated-path-or-no-signal |
| Implied Volatility Rank | 0 | 0 | dedicated-path-or-no-signal |
| Cumulative Volume Delta | 1 | 2880 | finite-calculation |
| CVD Divergence | 3 | 2910 | finite-calculation |
| Pulling & Stacking | 0 | 0 | dedicated-path-or-no-signal |
| Delta Bar | 1 | 2880 | finite-calculation |
| Delta % Highlight | 0 | 0 | dedicated-path-or-no-signal |
| Delta Cumulative Candlestick | 1 | 2880 | finite-calculation |
| Delta Cumulative Histogram | 1 | 2880 | finite-calculation |
| Imbalance Tracker | 0 | 0 | dedicated-path-or-no-signal |
| Imbalance Rejector | 0 | 0 | dedicated-path-or-no-signal |
| Unfinished Auction | 0 | 0 | dedicated-path-or-no-signal |
| Bar POC Indicator | 0 | 0 | dedicated-path-or-no-signal |
| Dynamic POC | 0 | 0 | dedicated-path-or-no-signal |
| Speed of Tape | 0 | 0 | dedicated-path-or-no-signal |
| Speed of Tape (Instant) | 0 | 0 | dedicated-path-or-no-signal |
| Volume/Delta Sprint | 1 | 2871 | finite-calculation |
| Tape Speed & Order-Flow Burst | 0 | 0 | dedicated-path-or-no-signal |
| Big Contracts | 0 | 0 | dedicated-path-or-no-signal |
| Ratio Highlight | 0 | 0 | dedicated-path-or-no-signal |
| Stop Spotter | 0 | 0 | dedicated-path-or-no-signal |
| Auction Gap Tracker | 0 | 0 | dedicated-path-or-no-signal |
| Session Imbalance | 0 | 0 | dedicated-path-or-no-signal |
| Absorption Detector | 0 | 0 | dedicated-path-or-no-signal |
| Stacked Imbalance Suite | 0 | 0 | dedicated-path-or-no-signal |
| Iceberg / Refresh Detector | 0 | 0 | dedicated-path-or-no-signal |
| Liquidity Sweep / Stop Sweep Detector | 0 | 0 | dedicated-path-or-no-signal |
| POC & Auction Suite | 0 | 0 | dedicated-path-or-no-signal |
| Cumulative Iceberg/Stop | 0 | 0 | dedicated-path-or-no-signal |
| Book Speed | 0 | 0 | dedicated-path-or-no-signal |
| DOM Pro | 0 | 0 | dedicated-path-or-no-signal |
| Mini DOM | 0 | 0 | dedicated-path-or-no-signal |
| Footprint | 0 | 0 | dedicated-path-or-no-signal |
| KWANT Delta | 17 | 781 | finite-calculation |
| KWANT Wall | 0 | 0 | dedicated-path-or-no-signal |
| KWANT V-Tracker | 0 | 0 | dedicated-path-or-no-signal |
| Volume | 1 | 2880 | finite-calculation |
| Daily Volume Profile | 0 | 0 | dedicated-path-or-no-signal |
| TPO Daily | 0 | 0 | dedicated-path-or-no-signal |
| TPO Weekly | 0 | 0 | dedicated-path-or-no-signal |
| Weekly Volume Profile | 0 | 0 | dedicated-path-or-no-signal |
| Monthly Volume Profile | 0 | 0 | dedicated-path-or-no-signal |
| Session Volume Profile | 0 | 0 | dedicated-path-or-no-signal |
| Composite Volume Profile | 0 | 0 | dedicated-path-or-no-signal |
| Visible Range Volume Profile | 0 | 0 | dedicated-path-or-no-signal |
| Custom Draw-On Volume Profile | 0 | 0 | dedicated-path-or-no-signal |
| Ask/Bid Volume Profile | 0 | 0 | dedicated-path-or-no-signal |
| Delta Profile | 0 | 0 | dedicated-path-or-no-signal |
| KWANT Profile Swing | 0 | 0 | dedicated-path-or-no-signal |
| KWANT Profile Values | 0 | 0 | dedicated-path-or-no-signal |
| TPO Levels | 0 | 0 | dedicated-path-or-no-signal |
| VWAP | 11 | 2880 | finite-calculation |
| VWAP Envelopes | 11 | 20160 | finite-calculation |
| Anchored VWAP | 0 | 0 | dedicated-path-or-no-signal |
| Rolling VWAP | 11 | 20160 | finite-calculation |
| Market Statistics | 0 | 0 | dedicated-path-or-no-signal |
| On Candle Stats | 0 | 0 | dedicated-path-or-no-signal |
| Important Levels | 35 | 70 | finite-calculation |
| Absolute Levels | 2 | 2 | finite-calculation |
| Pivot Points | 5 | 10 | finite-calculation |
| Price Movement Levels | 11 | 66 | finite-calculation |
| FVG Identifier | 2 | 0 | finite-calculation |
| Gap Detector | 2 | 0 | finite-calculation |
| Divergence Detector | 0 | 0 | dedicated-path-or-no-signal |
| Confluence Identifier | 0 | 0 | dedicated-path-or-no-signal |
| Swing Point | 2 | 1296 | finite-calculation |
| Average Daily Range Target | 7 | 14 | finite-calculation |
| Sessions | 0 | 0 | dedicated-path-or-no-signal |
| Session Highs & Lows | 0 | 0 | dedicated-path-or-no-signal |
| IB Levels | 0 | 0 | dedicated-path-or-no-signal |
| Kwant Levels | 0 | 0 | dedicated-path-or-no-signal |
| Classic GEX Profile | 0 | 0 | dedicated-path-or-no-signal |
| Session Marker | 0 | 0 | dedicated-path-or-no-signal |
| Shift Candle | 2 | 0 | finite-calculation |
| Moving Average | 1 | 2861 | finite-calculation |
| Ichimoku Indicator | 5 | 14265 | finite-calculation |
| Parabolic SAR | 1 | 2879 | finite-calculation |
| Linear Regression | 1 | 2860 | finite-calculation |
| Regression Channel | 3 | 300 | finite-calculation |
| Super Trend | 1 | 2871 | finite-calculation |
| Super Trend Difference | 1 | 2871 | finite-calculation |
| Keltner Channel | 3 | 8622 | finite-calculation |
| Bollinger Bands | 3 | 8583 | finite-calculation |
| Donchian Channel | 3 | 8583 | finite-calculation |
| Tillson T3 | 1 | 2802 | finite-calculation |
| Zig Zag | 3 | 263 | finite-calculation |
| Relative Strength Index (RSI) | 1 | 2866 | finite-calculation |
| Rate of Change (ROC) | 1 | 2868 | finite-calculation |
| MACD Indicator | 3 | 8640 | finite-calculation |
| Momentum Indicator | 1 | 2870 | finite-calculation |
| Commodity Channel Index (CCI) | 1 | 2861 | finite-calculation |
| Know Sure Thing (KST) | 3 | 5665 | finite-calculation |
| Inverse Cyber Cycle | 5 | 5660 | finite-calculation |
| Aroon Up/Down | 2 | 5710 | finite-calculation |
| Aroon Oscillator | 1 | 2855 | finite-calculation |
| Awesome Oscillator | 1 | 2847 | finite-calculation |
| Stochastic Oscillator | 2 | 5728 | finite-calculation |
| Williams %R | 1 | 2867 | finite-calculation |
| Chaikin Accumulation/Distribution | 1 | 2880 | finite-calculation |
| Average Directional Index (ADX) | 3 | 8585 | finite-calculation |
| Standard Deviation | 1 | 2861 | finite-calculation |
| Average True Range (ATR) | 1 | 2867 | finite-calculation |
| Expected Move | 0 | 0 | dedicated-path-or-no-signal |
| Candlestick Bar | 0 | 0 | dedicated-path-or-no-signal |
| Overlay Chart | 0 | 0 | dedicated-path-or-no-signal |
| Overlay Symbol | 0 | 0 | dedicated-path-or-no-signal |
| Overlay Timeframe Candlestick | 0 | 0 | dedicated-path-or-no-signal |
| Overlay Timeframe Highlight | 1 | 192 | finite-calculation |
| Annotations Overlay | 0 | 0 | dedicated-path-or-no-signal |
| Text on Chart | 1 | 1 | finite-calculation |
| Source Code Indicator | 0 | 0 | dedicated-path-or-no-signal |
| KWANT Stats | 0 | 0 | dedicated-path-or-no-signal |
| Hedge Levels | 0 | 0 | dedicated-path-or-no-signal |
| KWANT-M IVB | 0 | 0 | dedicated-path-or-no-signal |
| KWANT Pattern Builder | 0 | 0 | dedicated-path-or-no-signal |
| Big Blocks | 0 | 0 | dedicated-path-or-no-signal |
