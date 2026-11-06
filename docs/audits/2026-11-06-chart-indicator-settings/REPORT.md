# Chart indicator settings audit

6 November 2026, Australia/Brisbane

## Findings

| Indicator | Finding | Correction |
| --- | --- | --- |
| Big Contracts | On a regular-hours tape with fewer than 30 samples, the fallback scale also inherited the overnight filter mode and minimum. | The fallback can borrow sample data for marker sizing. Regular hours still use their own settings. The exact 4, 5 and 6 contract fixture passes for a five-contract minimum. |
| Big Contracts | Maximum trade size was ignored when the separately configured visual cap was off or had its own value. | Live, full and retained marker eligibility share the inclusive maximum. Zero remains unlimited. A visual cap still changes marker sizing. |
| Bar POC Indicator | Aggregate trades produced the same result as Volume. Order count actually counted executed trades. | Removed the duplicate. Renamed the remaining count mode Trade count and preserved its output for saved charts. |
| KWANT Delta | Aggregate trades used the Volume path. Order used the same executed trade count as Trades. | Removed both duplicates and migrated saved values to their equivalent choices. |
| KWANT Profile Values | Custom start and end displayed UTC and parsed edits as browser-local time. Historical order mode always returned a waiting result. | The fields are labelled UTC and use UTC for both display and edits. Removed the unavailable input mode. |
| Confluence Identifier | A selected start date displayed UTC and parsed edits as local time. Order mode could only report missing order history. | The date now round-trips in UTC. Removed the input selector because Volume is the only supported input. |
| Market Statistics | Order mode always reported missing historical order events. | Removed that choice. Exact execution and bar modes remain available. |
| Speed of Tape | Order mode always returned an unavailable result from the current execution feed. | Removed that choice. Volume and Trades remain available. |
| Pulling & Stacking | Own-order and implied-order controls could never change the result because the feed has no matching classifications. | Removed both unsupported controls. |

Saved unavailable order modes in KWANT Profile Values, Confluence Identifier, Market Statistics and Speed of Tape now restore in Volume mode. This is a migration of the saved selection. It does not reinterpret archived orders as executions. Existing stored timestamps are preserved because the original intended clock cannot be recovered.

## Verification

- 124 registered studies inventoried across nine categories, with 4,302 default setting entries. This includes internal metadata and shared settings. The A–Z ledger below includes the internal saved-script adapter and the draw-on profile.
- 10,313 isolated React dialog actions, 8,718 saved changes and zero uncaught interaction errors in the consolidated run. Repeated shared actions count separately. The eight modified study dialogs were rerun after the corrections.
- 122 public studies passed Add, disable, enable and remove. Custom Draw-On Volume Profile armed drawing placement. The internal saved-script adapter has no public card. All 124 studies passed Save, Close, JSON restore and Reopen.
- 200 dropdown choices retested across the affected menus and both Bounce Levels modes. The prior audit records 2,072 offered choices. It remains the baseline evidence for the other menus.
- The three UTC fields were edited through the dialog with the browser environment set to Australia/Brisbane. All three saved 5 November 2026 at 10:30 UTC exactly.
- 572 setting mutations on 49 common candle calculators produced 340 observed output changes. The other 232 mutations produced no change under that input. Conditional styles, absent events and dedicated renderers need different fixtures.
- All 11 authoritative fixture suites passed. All 40 targeted setting, execution, Footprint and alert tests passed, alongside 35 profile, TPO and catalogue tests, the 14 Big Contracts filter/session checks, and volume-profile grouping and filter checks. The isolated production build passed TypeScript and generated 86 pages.
- The standalone legacy Big Contracts delivery harness still fails in its extracted workspace fixture at missing mock `markMarketActive`. The separate chart callback fixture was updated for the current live accumulator and passed.

## Verification limits

The report separates popup wiring and persistence from numerical and rendering checks. It does not certify every conditional combination, live provider value, canvas pixel, historical reconstruction or alert trigger. Exact execution, depth and options history coverage varies by instrument and date. Import and template-name fields use their own action flow. The dialog sweep does not operate the OS file picker. Six duplicated visibility elements could not be matched after resetting three dialogs. The separate lifecycle tests exercised the actual visibility toggle for all three studies.

Machine-readable counts, UTC inputs and per-indicator rows are in [evidence.json](evidence.json). The [previous audit](../2026-11-04-indicator-controls/FINDINGS.md) contains the full per-setting source inventory, earlier fixes and test triage. The 97 settings with no literal runtime reference match previously classified entries. That comparison is a source check.

## A–Z ledger

| Indicator | Category | Defaults | Dialog actions | Save / reopen | Candle fixture changed / probed | This release |
| --- | --- | ---: | ---: | --- | ---: | --- |
| Absolute Levels | Market Structure | 9 | 36 | passed | 5 / 7 | Reviewed |
| Absorption Detector | Order Flow | 129 | 161 | passed | Dedicated | Reviewed |
| Aroon Oscillator | Momentum | 2 | 25 | passed | 1 / 2 | Reviewed |
| Aroon Up/Down | Momentum | 3 | 27 | passed | 1 / 3 | Reviewed |
| Ask/Bid Volume Profile | Volume & Profiles | 97 | 337 | passed | Dedicated | Reviewed |
| Auction Gap Tracker | Order Flow | 26 | 55 | passed | Dedicated | Reviewed |
| Average Daily Range Target | Market Structure | 7 | 32 | passed | 3 / 5 | Reviewed |
| Average Directional Index (ADX) | Momentum | 9 | 35 | passed | 5 / 8 | Reviewed |
| Average True Range (ATR) | Volatility | 2 | 25 | passed | 1 / 2 | Reviewed |
| Awesome Oscillator | Momentum | 3 | 27 | passed | 2 / 3 | Reviewed |
| Bar POC Indicator | Order Flow | 30 | 65 | passed | Dedicated | Adjusted |
| Big Blocks | KWANT Systems | 28 | 58 | passed | Dedicated | Reviewed |
| Big Blocks (Options) | Options Flow | 17 | 48 | passed | Dedicated | Reviewed |
| Big Contracts | Order Flow | 47 | 80 | passed | Dedicated | Adjusted |
| Bollinger Bands | Trend | 5 | 31 | passed | 2 / 5 | Reviewed |
| Book Speed | Order Flow | 17 | 51 | passed | Dedicated | Reviewed |
| Bounce Levels | Options Flow | 109 | 111 | passed | Dedicated | Reviewed |
| Chaikin Accumulation/Distribution | Momentum | 1 | 23 | passed | 0 / 1 | Reviewed |
| Classic GEX Profile | Market Structure | 25 | 53 | passed | Dedicated | Reviewed |
| Commodity Channel Index (CCI) | Momentum | 2 | 25 | passed | 1 / 2 | Reviewed |
| Composite Volume Profile | Volume & Profiles | 102 | 339 | passed | Dedicated | Reviewed |
| Confluence Identifier | Market Structure | 80 | 127 | passed | Dedicated | Adjusted |
| Cumulative Iceberg/Stop | Order Flow | 22 | 60 | passed | Dedicated | Reviewed |
| Cumulative Volume Delta | Order Flow | 26 | 59 | passed | 8 / 20 | Reviewed |
| Custom Draw-On Volume Profile | Volume & Profiles | 97 | 334 | passed | Dedicated | Reviewed |
| CVD Divergence | Order Flow | 7 | 34 | passed | 4 / 7 | Reviewed |
| Daily Volume Profile | Volume & Profiles | 97 | 337 | passed | Dedicated | Reviewed |
| Dark Pool (GEX) | Options Flow | 103 | 171 | passed | Dedicated | Reviewed |
| Dark Pool Map | Options Flow | 66 | 136 | passed | Dedicated | Reviewed |
| Delta % Highlight | Order Flow | 13 | 37 | passed | Dedicated | Reviewed |
| Delta Bar | Order Flow | 12 | 46 | passed | 1 / 11 | Reviewed |
| Delta Cumulative Candlestick | Order Flow | 27 | 61 | passed | 9 / 21 | Reviewed |
| Delta Cumulative Histogram | Order Flow | 20 | 50 | passed | 8 / 15 | Reviewed |
| Delta Profile | Volume & Profiles | 97 | 337 | passed | Dedicated | Reviewed |
| Divergence Detector | Market Structure | 20 | 50 | passed | Dedicated | Reviewed |
| DOM Pro | Order Flow | 24 | 53 | passed | Dedicated | Reviewed |
| Donchian Channel | Trend | 4 | 29 | passed | 1 / 4 | Reviewed |
| Dynamic POC | Order Flow | 18 | 48 | passed | Dedicated | Reviewed |
| Expected Move | Volatility | 10 | 33 | passed | Dedicated | Reviewed |
| Footprint | Order Flow | 112 | 205 | passed | Dedicated | Reviewed |
| FVG Identifier | Market Structure | 11 | 38 | passed | 4 / 11 | Reviewed |
| Gamma Environment | Options Flow | 8 | 34 | passed | Dedicated | Reviewed |
| Gamma Heatmap | Options Flow | 19 | 47 | passed | Dedicated | Reviewed |
| Gap Detector | Market Structure | 9 | 33 | passed | 2 / 7 | Reviewed |
| GEX Interval Map | Options Flow | 79 | 144 | passed | Dedicated | Reviewed |
| Hedge Levels | KWANT Systems | 5 | 14 | passed | Dedicated | Reviewed |
| IB Levels | Market Structure | 43 | 60 | passed | Dedicated | Reviewed |
| Iceberg / Refresh Detector | Order Flow | 93 | 114 | passed | Dedicated | Reviewed |
| Ichimoku Indicator | Trend | 39 | 74 | passed | 22 / 29 | Reviewed |
| Imbalance Rejector | Order Flow | 14 | 42 | passed | Dedicated | Reviewed |
| Imbalance Tracker | Order Flow | 26 | 66 | passed | Dedicated | Reviewed |
| Implied Volatility Rank | Options Flow | 38 | 89 | passed | Dedicated | Reviewed |
| Important Levels | Market Structure | 45 | 75 | passed | 25 / 39 | Reviewed |
| Inverse Cyber Cycle | Momentum | 31 | 67 | passed | 16 / 24 | Reviewed |
| Keltner Channel | Trend | 6 | 33 | passed | 3 / 6 | Reviewed |
| Know Sure Thing (KST) | Momentum | 44 | 83 | passed | 30 / 35 | Reviewed |
| KWANT Delta | Order Flow | 43 | 100 | passed | 13 / 38 | Adjusted |
| Kwant Levels | Market Structure | 13 | 39 | passed | Dedicated | Reviewed |
| KWANT Pattern Builder | KWANT Systems | 34 | 74 | passed | Dedicated | Reviewed |
| KWANT Profile Swing | Volume & Profiles | 41 | 87 | passed | Dedicated | Reviewed |
| KWANT Profile Values | Volume & Profiles | 63 | 113 | passed | Dedicated | Adjusted |
| KWANT Stats | KWANT Systems | 37 | 95 | passed | Dedicated | Reviewed |
| KWANT V-Tracker | Order Flow | 26 | 63 | passed | Dedicated | Reviewed |
| KWANT Wall | Order Flow | 19 | 53 | passed | Dedicated | Reviewed |
| KWANT-M IVB | KWANT Systems | 17 | 51 | passed | Dedicated | Reviewed |
| Linear Regression | Trend | 10 | 35 | passed | 5 / 7 | Reviewed |
| Liquidity Sweep / Stop Sweep Detector | Order Flow | 75 | 104 | passed | Dedicated | Reviewed |
| MACD Indicator | Momentum | 6 | 33 | passed | 3 / 6 | Reviewed |
| Market Statistics | Volume & Profiles | 20 | 54 | passed | Dedicated | Adjusted |
| Mini DOM | Order Flow | 13 | 47 | passed | Dedicated | Reviewed |
| Momentum Indicator | Momentum | 2 | 25 | passed | 1 / 2 | Reviewed |
| Monthly Volume Profile | Volume & Profiles | 97 | 337 | passed | Dedicated | Reviewed |
| Moving Average | Trend | 2 | 25 | passed | 1 / 2 | Reviewed |
| Net Gamma Exposure By Strike | Options Flow | 68 | 120 | passed | Dedicated | Reviewed |
| On Candle Stats | Volume & Profiles | 40 | 71 | passed | Dedicated | Reviewed |
| Options Delta | Options Flow | 4 | 28 | passed | Dedicated | Reviewed |
| Overlay Chart | Overlays | 17 | 49 | passed | Dedicated | Reviewed |
| Overlay Symbol | Overlays | 17 | 48 | passed | Dedicated | Reviewed |
| Overlay Timeframe Candlestick | Overlays | 11 | 37 | passed | Dedicated | Reviewed |
| Overlay Timeframe Highlight | Overlays | 30 | 68 | passed | 27 / 27 | Reviewed |
| Parabolic SAR | Trend | 10 | 36 | passed | 6 / 8 | Reviewed |
| Pivot Points | Market Structure | 17 | 47 | passed | 4 / 12 | Reviewed |
| POC & Auction Suite | Order Flow | 97 | 125 | passed | Dedicated | Reviewed |
| Price Movement Levels | Market Structure | 20 | 59 | passed | 8 / 13 | Reviewed |
| Pulling & Stacking | Order Flow | 87 | 186 | passed | Dedicated | Adjusted |
| Rate of Change (ROC) | Momentum | 2 | 25 | passed | 1 / 2 | Reviewed |
| Ratio Highlight | Order Flow | 8 | 33 | passed | Dedicated | Reviewed |
| Regression Channel | Trend | 22 | 66 | passed | 6 / 17 | Reviewed |
| Relative Strength Index (RSI) | Momentum | 2 | 25 | passed | 1 / 2 | Reviewed |
| Rolling VWAP | Volume & Profiles | 32 | 71 | passed | 15 / 26 | Reviewed |
| Session Highs & Lows | Market Structure | 30 | 30 | passed | Dedicated | Reviewed |
| Session Imbalance | Order Flow | 30 | 60 | passed | Dedicated | Reviewed |
| Session Marker | Market Structure | 64 | 124 | passed | Dedicated | Reviewed |
| Session Volume Profile | Volume & Profiles | 97 | 337 | passed | Dedicated | Reviewed |
| Sessions | Market Structure | 39 | 56 | passed | Dedicated | Reviewed |
| Shift Candle | Market Structure | 26 | 61 | passed | Dedicated | Reviewed |
| Source Code Indicator | Overlays | 0 | 8 | passed | Dedicated | Reviewed |
| Speed of Tape | Order Flow | 12 | 41 | passed | Dedicated | Adjusted |
| Speed of Tape (Instant) | Order Flow | 20 | 53 | passed | Dedicated | Reviewed |
| Stacked Imbalance Suite | Order Flow | 53 | 91 | passed | Dedicated | Reviewed |
| Standard Deviation | Volatility | 2 | 25 | passed | 1 / 2 | Reviewed |
| Stochastic Oscillator | Momentum | 4 | 29 | passed | 2 / 4 | Reviewed |
| Stop Spotter | Order Flow | 38 | 77 | passed | Dedicated | Reviewed |
| Super Trend | Trend | 21 | 47 | passed | 15 / 15 | Reviewed |
| Super Trend Difference | Trend | 16 | 41 | passed | 12 / 12 | Reviewed |
| Swing Point | Market Structure | 13 | 47 | passed | 7 / 11 | Reviewed |
| Tape Speed & Order-Flow Burst | Order Flow | 54 | 111 | passed | Dedicated | Reviewed |
| Text on Chart | Overlays | 5 | 29 | passed | 2 / 4 | Reviewed |
| Tillson T3 | Trend | 12 | 38 | passed | 5 / 7 | Reviewed |
| TPO Daily | Volume & Profiles | 174 | 257 | passed | Dedicated | Reviewed |
| TPO Levels | Volume & Profiles | 26 | 69 | passed | Dedicated | Reviewed |
| TPO Weekly | Volume & Profiles | 174 | 251 | passed | Dedicated | Reviewed |
| Unfinished Auction | Order Flow | 17 | 45 | passed | Dedicated | Reviewed |
| Visible Range Volume Profile | Volume & Profiles | 97 | 337 | passed | Dedicated | Reviewed |
| VIX Environment | Volatility | 19 | 60 | passed | Dedicated | Reviewed |
| Volume | Volume & Profiles | 5 | 28 | passed | 2 / 3 | Reviewed |
| Volume/Delta Sprint | Order Flow | 18 | 48 | passed | 8 / 14 | Reviewed |
| VWAP | Volume & Profiles | 33 | 73 | passed | 16 / 27 | Reviewed |
| VWAP Envelopes | Volume & Profiles | 32 | 71 | passed | 14 / 26 | Reviewed |
| Weekly Volume Profile | Volume & Profiles | 99 | 337 | passed | Dedicated | Reviewed |
| Williams %R | Momentum | 2 | 25 | passed | 1 / 2 | Reviewed |
| Zero Gamma Bars | Options Flow | 4 | 28 | passed | Dedicated | Reviewed |
| Zero Gamma Line | Options Flow | 10 | 36 | passed | Dedicated | Reviewed |
| Zig Zag | Trend | 19 | 50 | passed | 10 / 16 | Reviewed |
