# GEX Data detailed re-audit — 24 October 2026

This is a fresh acceptance ledger, not inherited completion from older reports.
User requests every current GEX Data tool compared1:1 against QuantData.
Preserve KwantDesk theme/typography; numerical/functional parity is the goal.

## Evidence rules and boundaries

- Match instrument, exchange session, interval, expiry/strike, moneyness, groups,
  units, selected snapshot and chart window before comparing numbers.
- Record headline, bucket/cell/trade, interaction, live cadence and recovery
  acceptance independently. Rounded headline/visual similarity is not a full pass.
- QuantData signed-in browser tab9, KwantDesk isolated audit tab92. Reference
  browser changes are UI-only; no session credential extraction/private API replay.
- REA skill used for investigation routing. A literal loopback CDP endpoint for
  the in-app tabs was not exposed by current browser/process inventory. UI
  observations below use the supported browser automation, not REA Evidence IDs.
  Source review is source evidence, not observation of reference execution.
- Existing docs/GEX-DATA-PARITY-CHECKLIST.md is dirty pre-existing user work and
  is not overwritten. Earlier checks are background evidence only.

## Catalogue (all22 current tools)

| # | Tool | Fresh acceptance state |
|---|---|---|
|1|Dark Flow|Partial: SPY2026-10-16/1m headline and full-session shape agree; raw buckets/cadence not certified|
|2|Dark Pool Levels|SPY Oct16 Top10: all10 rows/5cells/fractions numerically match; theme contrast defect repaired locally; runtime gates open|
|3|Equity Prints|Repaired local table: all53 displayed reference trades/all7cells exact including lit-only side badges and Date-first order; live gates open|
|4|Exchange Notifications|All46 LUDP-only Oct16 rows/all4cells match exactly; live/recovery gates open|
|5|Market Map|Oct16 Industry: visible major ticker returns agree; full tile/interaction gates open; latest control ends6:14 vs reference6:15|
|6|Stock Price / Time|SPY Oct16/5m/Line:762.74 headline and major path agree; every OHLC bucket/runtime gates open|
|7|Consolidated Order Flow|FAIL aggregate parity persists freshly: reference50.70%,17.09M/16.72M,$14.11B/$20.11B vs licensed REST50.71%,17.11M/16.79M,$14.15B/$20.16B|
|8|Contract Price / Time|SPY Oct16/Oct19 expiry/766 PUT/1m:4.80 and underlying762.74 agree; OHLC/volume path visually agrees; raw bucket gates open|
|9|Contract Side Statistics|Oct16 ITM Trade Count: all5 side call/put counts and fractions visually exact; runtime gates open|
|10|Contract Statistics|Oct16 AboveAsk+Ask: all3 paired values and6 fractions exact; runtime gates open|
|11|Gainers / Losers|Technology Oct16:53 visible rows/all8cells exact; all-market source discrepancy not closed; ranking-control issue observed|
|12|Market Share|Oct16 TotalPremium/ExchangeGroup/Bar: all7 values/fractions match; group row order differs from current reference|
|13|Market Share Table|Oct16 all-instruments: all21rows/all17cells exact including TOTAL, after accounting for reference blank IEX group|
|14|Exposure by Expiration|SPY Oct16 NETDEX/per$1:-37.65B and33-bar shape/axes agree; raw all-snapshot gates open|
|15|Exposure by Strike|SPY Oct16 GEX/per1%: net-28.93B/spot762.74; split call/put geometry matches after matching display; raw gates open|
|16|Exposure Forecast|FAIL: endpoint=null; no connected licensed forecast implementation|
|17|Heat Map|SPY Oct16 NETGEX: MVC763/Oct16,spot762.74 and overlapping visible cells agree; all46 modes/raw-minute gates open|
|18|Implied Volatility Rank|SPY CALL/365/30:29.07%; Aug28+Sep4 zero-rank points and769.12/769.70spot agree; asynchronous live spot differs cents|
|19|Interval Map|SPY Oct16/5m/GEX: Value and Difference major bubble paths agree;6:05AM strike763 raw fold matches reference rounded call/put/net; full raw lattice/cadence open|
|20|Max Pain|SPY Oct16/Oct19 expiry:773pain/762.74spot,550..950 extent and intrinsic-value shape agree; every raw strike open|
|21|Max Pain / Time|SPY Oct16:33-point expiry curve visually agrees,820peak/725trough/762.74spot; raw-date gates open|
|22|Net Drift|SPY Oct16/1m:CALL-16.41M/PUT64.76M/spot762.74 and premium/volume paths agree; click-range repair tested; raw bucket/cadence gates open|

## Current observations

###1. Dark Flow

QuantData: SPY,16October2026, reference stored historical state. KwantDesk:
isolated instance `parity-audit-20261024`, same session/SPY/1min/full navigator.
Both visible headlines: notional23.44B, underlying761.10. Major notional spikes,
underlying path and two axis ranges visually align after maximizing reference.
Browser viewport shapes differ; colors intentionally differ with account theme.
Reference starts around18:00 Brisbane; final underlying~761.10; no claim every
939 historical bucket was reconciled from pixels/headlines.

### Shared implementation gaps

- All ordinary tools currently have a30s client refresh floor, IV Rank60s.
  Requests start after completion; current route responses cache15s. This is
  not proof of QuantData's private dashboard cadence and is not1ms streaming.
  Do not shorten timers indiscriminately and multiply vendor/Vercel costs.
- Reference has Net Flow, Unconsolidated Order Flow and Volatility Skew tabs;
  our22-tool catalogue lacks standalone counterparts. Individual unconsolidated
  trades exist only in the Net Drift detail adapter.
- Four tools couple their successful data to an auxiliary price/timeline call
  via Promise.all. This can suppress genuine exposure if auxiliary history fails.
  Local repair retains successful primary data with absent spot/timeline and
  explicit internal price-history-unavailable metadata; cancellation and primary
  failure still fail. Nine actual-loader runtime tests pass.
- Net Drift1m drilldown uses the next available row as end; when14:00is followed
  by14:05, a clicked minute requests five minutes. Reproduced by executing the
  actual renderer against fixture rows; not an inferred provider-math change.
  Local repair uses the selected interval duration, tested for all12 offered
  periods including final/contiguous/gapped buckets and millisecond timestamps.
- Prior captured evidence supports absolute sparse interval replacements and
  cumulative Net Drift/leading-zero preprocessing. Do not change either solely
  to make a picture look closer.

No tool is declared fully matched until every required acceptance gate has
independent supporting evidence. Forecast/missing catalogue/data-source gaps
must remain visible rather than fabricated.

### Fresh table and chart details

- Dark Pool Levels: matched SPY,From/Through2026-10-16,Top10 and descending
  price. Each rank/price/notional/trade-count/volume and displayed fraction
  agrees. Monochrome white fills hide white numbers; local opacity-only fill
  repair preserves values, semantic color and exact fraction width.
- Equity Prints: all instruments,Oct16.53 visible reference rows compared
  against100 licensed-source rows. Ten discrepancies are missing A/AA/B side
  badges, not numerical price corrections. Provider equity field is tradeSide,
  option field tradeSideCode. Local formatter now uses the appropriate field,
  never infers execution side from a later bid/ask. Formatter tests pass;
  Actual source confirms only LIT_POOL executions show these badges in the
  reference; DARK_POOL sides stay hidden. With that condition, repaired local
  table now matches all53 rows/all7cells exactly (including Date-first order),
  after normalizing DOM's quoted numeric text and date-column comparison order.
- Date initially appears at the end when switching Latest to Historical.
  Local column-order merge restores schema placement while preserving saved
  custom order/hidden/width state; four actual TableView lifecycle tests pass.
- Exchange Notifications: reference46LUDP rows; ours46; exact46/46 comparison
  across date/time/ticker/type after putting dates in common comparison order.
  Oct16exchange session legitimately contains Oct17Brisbane display dates.
- Market Map: Industry grouping,Oct16. Visible NVDA-1.38%,AVGO-4.52%,
  MU-5.64%,AAPL+0.48%,MSFT-1.89%,SPY-1.17%,XOM+2.47%,TSLA-2.19%
  agree. Browser aspect ratios change treemap geometry. No claim every tile
  or historical minute was reconciled.
- Stock Price/Time: SPY,Oct16,5Min,Line. Both762.74 and matching major
  peaks/troughs. Reference nice price extent760–772.50; ours visible axis
  extends to775. This is a plotting-domain discrepancy, not proven bad prices.
  Root cause found: line view incorrectly used invisible wick highs/lows for
  scaling. Local line bounds now use plotted closes; candle bounds retain
  authoritative low/high. Two regression tests pass; browser verification open.
- Consolidated: freshly reproduced same older aggregate discrepancy using
  all-instruments historicalOct16. Source review establishes different licensed
  REST versus private website backend baselines; exact cause not established.
  Do not add offsets or derive full-session totals from100 loaded trades.
- Contract Price/Time: matched Oct16 SPY766PUT expiryOct19/1m candlestick.
  Both4.80contract/762.74underlying; both price axes0–7 and760–775, volume
  axis0–5K. Major minute candle/volume spikes and underlying path agree visually.
  Also independently loaded CALL with1.62close, but fresh reference remainedPUT;
  CALL is not marked freshly reconciled from that alone.
- Contract Side Statistics: ITM/all-instruments/Oct16/Trade Count. AboveAsk
  PUT14K63.75%/CALL8K36.25%; Ask600K55.17%/487K44.83%; Mid145K56.05%/
  113K43.95%; Bid618K53.67%/533K46.33%; BelowBid14K65.02%/8K34.98%.
  All displayed values/fractions match reference; headline rounds both totals1M.
- Contract Statistics: all moneyness,AboveAsk+Ask,Oct16. PUT/CALL Premium
  11.24B39.58%/17.16B60.42%; Volume21.77M49.44%/22.27M50.56%; TradeCount
  3.17M48.87%/3.31M51.13%. All displayed values/fractions match reference.
- Gainers/Losers: Technology,Oct16.53 visible reference rows match exactly
  against451 source rows across rank,ticker,bearish/bullish premium,ratio,
  volume/count/premium and all fractions. Reference is currently sorted by
  bullish premium. Changing our Rank by to Bearish left the old Bullish column
  sort active: confirmed control/sort ownership bug, not yet repaired.
- MarketShare: TotalPremium/ExchangeGroup/Bar. All7 totals/fractions match:
  BOX1.47B2.52%,NYSE6.36B10.96%,MEMX1.17B2.02%,NASDAQ9.83B16.92%,
  CBOE34.49B59.39%,MIAX4.70B8.09%,UNKNOWN51.30M0.09%. Our hardcoded
  group ordering differs from freshly observed reference order above; earlier
  claim that one static observed order was definitive does not hold here.
- MarketShareTable:21rows/17cells, all357 displayed cells exactly match,
  including ALL totals58,064,218,776premium/95,670,398volume/14,617,505trades.
  Reference omits blank unknown group before IEX; comparison pads that one
  missing text field only, not any numbers or percentage values.
- ExposureExpiration: SPY/Oct16/DELTA/per$1/net. Both-37.65B; matched33
  expiration-bar signs/major amplitudes and-20B..20B extent. Latest control
  correctly6:15AM on both. Earlier GAMMA default-28.93B also loaded, not
  substituted for reference's selected DELTA filter.
- ExposureStrike: SPY/Oct16/GAMMA/per1%. Reference selected split calls/puts,
  ours initially NET. After matching split, same725..800 range and-10B..10B
  scale, dominant763negative spike and call/put shape agree; spot762.74.
- HeatMap: SPY/Oct16/NETGEX,normal axes. MVC763/Oct16 and spot762.74 match.
  Overlapping visible cells include763/Oct16=-9.40B,762/Oct16=-7.26B,
  767/Oct16=258.26M,763/Oct19=-33.31M,763/Oct20=-12.22M,763/Oct21=569K,
  763/Oct22=-6.25M,763/Oct23=-57.51M. Different viewport aspect/saved
  windows show different counts of strikes/expirations, not different cell values.
- IVRank: SPY CALL/365lookback/30maturity, both29.07%. Reference hover
  Aug28=0%/769.12 and Sep4=0%/769.70; actual licensed response for those
  dates has lastIv=windowMinIv, producing0%, same spots. Current lastspot
  762.54..762.68 varies asynchronously; not a simultaneous exact-price pass.
- IntervalMap: SPY/Oct16/5m/GAMMA/5strike padding, both spot762.74.
  Matched Value then Difference through actual reference representation popup.
  Both major negative763/762 terminal positions and sparse difference bursts
  visually agree. Reference6:05AMOct17 strike763 hover CALL186.89M,
  PUT-8.40B,NET-8.21B. Actual licensed5m response, processed by the real
  foldIntervalUpdates function, gives186892545/-8395000326/-8208107781 at
  2026-10-16T20:05Z/763. Exact rounded hover agreement, not full lattice proof.

Additional repair: Rank/Metric control changes now replace old configured
sort; unchanged-control refreshes preserve a user's manual column sort.
Runtime TableView test covers both; local browser acceptance still pending.
MarketMap latest now uses the same dated verifiedSPYclose-control helper as
other snapshot tools. A real-helper test confirms20:14source+20:15latest
control with null sourceTime at close, never a fabricated extra source minute.

- MaxPain: SPY/Oct16/session,Oct19expiry. Same773pain and762.74spot
  markers,550..950strike extent and U-shaped intrinsic-value curves. Our
  marker formats773.00, reference773; numeric equality not identical formatting.
  Reference rounds several half-billion axis labels to repeated whole billions;
  ours distinguishes them. No market values changed to copy that rounding.
- MaxPain/Time: SPY/Oct16, same33-expiry curve,820peak/725trough and
  762.74underlying. Overlapping point labels agree including773,774,771,770,
  765,775,777,760,740,750,730,764,785,789. This is expiry-date data, not
  an intraday time-series reconstruction.
- NetDrift: reference initially Oct19; explicitly changed calendar toOct16,
  SPY/allmoneyness/noexpiry or strike/1m/net+bands hidden/underlying shown.
  BothCALL-16.41M,PUT64.76M,SPY762.74, premium-50M..75M and lower
  signed-volume-400K..100K; full major premium/price/volume path agrees.
  Click-range fix has actual-renderer VM regression evidence, not certification
  that every private composing trade or all405raw historical buckets match.

Final local browser acceptance:53/53captured Equity Prints rows match with
Date-first and lit-only badges; SPY5mLine now has matching760..772.50scale;
dark-pool table is readable in both QA dark/light themes; MarketMap terminal
now6:15AM/405 rather than6:14AM/404; changing ranking to Bearish moves the
descending arrow and correctly orders MU,NVDA,AMD,AAPL,AVGO,INTC,PLTR,MSFT,MSTR.

All22 current catalogue tools have now received fresh UI/source coverage in
order. Coverage is NOT blanket parity acceptance. The source/cadence/forecast
and full raw snapshot gates above remain unresolved.

Local verification:134/134 tests in tests/gex-data-reference pass;
147/147 with GEX integration/format checks;27/27 gateway budget checks.
Final production build/TypeScript/84static pages pass. Scoped React ESLint
has zero errors and one pre-existing cleanup-ref warning in OptionsFlowToolPanel.
These tests are regression evidence, not proof of reference/live parity.
No production deployment, new paid service, extra long-running provider poller
or VPS restart has been performed for this re-audit.

## Release and post-release startup gate

First scoped release3c9cfce403e3165dfb118f404d6d8e247209f71b reached READY
on websiterepo-yfmi-hh62r6kf0-kwant-desk.vercel.app. Public diagnostics returned
that exact SHA; app12/table3/equity3/styles2 and host iframe5 verified live.
Temporary loopback QA server31396 was verified and stopped; tab93 closed.
The preceding no-deployment statement describes the pre-release audit phase.

Final signed-in page check then exposed another real startup problem: shell
authenticated identity/name appeared, but GEX frame remained absent. Source
assigns preferenceUserId only after await hydrateUserPreferences; that routine
waits on cloud read/write I/O before returning. GEX host returns no frame for
an empty account key, so optional preference sync can leave the tool blank.

Corrective change: separately publish the getUser-verified ID to GEX only,
before preference hydration. No anonymous/name fallback; API auth, trading and
journal preference gates unchanged. Reset identity on re-verification.
Because users can now edit GEX while hydration waits, preserve only changed,
bounded, valid GEX workspace JSON whose embedded accountKey matches that same
verified user. Never preserve another account's late storage. Real hydration
tests suspend the cloud read, edit GEX, release the read and prove same-owner
edits survive while unrelated newer cloud settings win; foreign edits do not.
Six new startup/ownership tests and existing+deferred hydration checks pass.
This requires one corrective deployment beyond the initial scoped release;
no repeated provider acquisition, poller increase or VPS restart is involved.
Corrective final verification:153GEX/startup/ownership/integration/reference
tests pass, deferred hydration script passes, helper/preference ESLint passes,
and the final production build/TypeScript/84static pages passes. The enormous
KwantifyWorkspace file is build/type checked; no whole-file ESLint pass claimed.
