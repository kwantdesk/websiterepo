# GEX DATA / licensed reference parity — 2026-10-20

This is an acceptance ledger, not a claim that the whole library matches.
Work one tool at a time. Do not tick a tool off merely because its model tests
pass. Preserve KwantDesk theme/font, real data and honest availability states.

## Required evidence per tool

- [ ] Identical instrument, exchange session date, expiry, moneyness, strike,
  aggregation and page/global/filter-group expressions.
- [ ] Same full-session and cropped windows; axes, units, precision and signs.
- [ ] Completed-session numerical reconciliation, including individual buckets
  and trades where supplied, not only rounded headline totals.
- [ ] Live source timestamps and observed cadence; revised buckets replace old
  buckets without double-counting. No invented interpolation or fabricated flow.
- [ ] Zoom, pan, navigation, details, adjustments, save/restore and theme checks.
- [ ] Provider quota, cost, stale/error/recovery and multi-panel acceptance.

## Tool ledger (source catalogue order)

| Tool | Status | Remaining acceptance |
| --- | --- | --- |
| Dark Flow | Historical data/curve/axis checks PASS; shared cadence OPEN | SPY2026-10-16:23.44B notional,761.10spot; full-session curves matched; default money-axis precision corrected and retested locally |
| Dark Pool Levels | Completed-session numerical PASS; shared cadence OPEN | SPY2026-10-16: all50rows/all5cells match; Top10membership and recalculated fractions also exact; remaining shared runtime/soak gates |
| Equity Prints | Completed-session numerical PASS; shared cadence OPEN | 80 distinct historical rows/all7cells exact after full-market selector and execution-cent precision fixes; shared runtime/soak gates remain |
| Exchange Notifications | Completed-session numerical/filter PASS; shared cadence OPEN | First47unfiltered rows exact; all46LUDP-only rows/all4cells exact; shared runtime/soak gates remain |
| Market Map | Historical visual/grouping PASS; deeper acceptance OPEN | Oct16largest visible ticker returns align in sector and industry modes; full per-tile/interaction/live gates remain |
| Stock Price / Time | Historical visual/interval/style PASS; deeper acceptance OPEN | SPYOct16close762.74 and price path align in1m candles/5m line; navigator mini-preview defect identified; live/bucket gates remain |
| Consolidated Order Flow | 46trades/all33fields PASS; source aggregates DIFFER | Ref50.70%,17.09Mput/16.72Mcall,14.11Bput/20.11Bcall vs REST50.71%,17.11M/16.79M,14.15B/20.16B; no numeric offsets; shared runtime gates remain |
| Contract Price / Time | Historical call/put visual PASS; deeper acceptance OPEN | SPYOct16/expiryOct19/strike766: CALL1.62, PUT4.80, underlying762.74; volume/path match after overlay nice-domain and volume-axis corrections; shared runtime/bucket gates remain |
| Contract Side Statistics | Historical metrics/filter visual PASS; shared cadence OPEN | Oct16 all-instruments Premium31.90Bcall/26.17Bput; Volume49.86M/45.81M; all5side values/fractions align; TradeCount+ITM match after restoring moneyness and count precision |
| Contract Statistics | Historical combined-filter visual PASS; shared cadence OPEN | Restored moneyness/side multiselects; AboveAsk+Ask: PUT11.24B/CALL17.16B,21.77M/22.27M,3.17M/3.31M and all6fractions match |
| Gainers / Losers | Technology46rows/all8cells PASS; all-market source DIFFER | Fixed abbreviated activity/fixed ratio precision, sector multiselect; Oct16 SPX upstream premium/volume/count differ and alter all-market fractions; no offsets |
| Market Share | Historical shares/modes/pie polish PASS; shared cadence OPEN | All20exchange EquityVolume pie fractions match; all7group TotalPremium bars/values/fractions match after stable group ordering; two-column pie labels browser-verified without collisions; shared runtime gates remain |
| Market Share Table | Historical21rows/all17cells PASS; shared cadence OPEN | All357cells including TOTAL exact after full-dollar formatting and unclassified-group presentation fixes; same actual licensed endpoint as MarketShare |
| Exposure by Expiration | Historical Greek/unit visual PASS; snapshot boundary OPEN | SPYOct16 NETGEX per1%=-28.93B; NETDEX per$1=-37.65B; bars align. Fixed net navigator sign/year labels/extra underlying legend; investigating latest minute06:14vs06:15 |
| Exposure by Strike | Historical NET/SPLIT visual PASS; snapshot boundary OPEN | SPYOct16 NETGEX=-28.93B and spot762.74 match; NET/SPLIT bars/marker/initial range align; fixed decimal-axis precision and retained gross strike navigator |
| Exposure Forecast | Unavailable | No connected licensed endpoint; never fabricate a forecast |
| Heat Map | Historical NETGEX visual PASS; remaining modes/runtime OPEN | SPYOct16 MVC763/expiryOct16 and spot762.74 exact; overlapping visible cell values align; swapped axes works locally; snapshot-close correction undergoing acceptance |
| Implied Volatility Rank | Combined/call-only visual PASS; cadence OPEN | SPY365-day lookback/30-day maturity:18.88% combined,20.93% CALL match; full historical curve shape matches; asynchronously sampled live spot differs by cents, not declared exact |
| Interval Map | Historical5m visual PASS; sparse/live acceptance OPEN | SPYOct16 spot762.74; bubble strikes/signs and underlying path align; corrected fresh default1m→5m to match reference; difference/sparse-update acceptance remains |
| Max Pain | Historical expiry/marker visual PASS; deep numerical OPEN | SPYOct16/expiryOct19: max pain773 and spot762.74; intrinsic-value curves/strike extent match visually; no claim every raw cell reconciled |
| Max Pain / Time | Historical curve visual PASS; deep numerical OPEN | SPYOct16 underlying762.74 and full expiry curve align including820 peak and725 trough; added missing strike-point labels; retest pending |
| Net Drift | Historical totals/curves and25prints PASS; live cadence OPEN | SPYOct16 CALL-16.41M/PUT64.76M/spot762.74; full price/premium/volume shapes align;25visible6:03AM individual prints/all32fields match after millisecond-clock correction; raw bucket and private cliff completeness not certified |

## Sequential continuation — all tools, no per-tool approval stops

- Dark Flow: matchingSPY2026-10-16/1m/full session returns23.44B notional and
 761.10last source spot in reference, production and corrected local QA. Both
  chart shapes match, including session's large notional spikes. Reference
  needed reload to actually use selected historical date; before reload it
  misleadingly retained current-session2.38B/767.65 under anOct16label.
  Corrected DarkFlow axis abbreviation precision (0digits vs header2digits)
  and fractional stock/strike ticks(772.50, not772.5). Licensed values unchanged.
- Found/fixed DarkPoolLevels extraneous sessionDate field when range specified,
  and flow pagination dropping first-page statistics; verification continues.
- DarkPoolLevels: default display sorting corrected to descending price while
  retaining notional-ranked TopN selection. All50rows and all5cells match the
  reference, including decimal prices, notional, counts, volumes and fractions.
  Changed reference slider50→10: all10rows and rebased fractions match too.
- EquityPrints: compared80 distinct actual source trades across two virtualized
  windows, all7cells exact after fixes. Default full-market selection is now
  available without removing explicit saved ticker choices. Whole-dollar
  execution prices retain cents ($1,289.00); strike formatting unchanged.
- ExchangeNotifications:47unfiltered rows/all4cells exact; filteredLUDP gives
 46events and all cells match. Both calendar date and timezone-adjusted date
  remain correct (Oct16exchange session can displayOct17Brisbane trades).
- MarketMap: largest visible ticker returns match in sector and industry
  grouping; aspect ratios intentionally differ between browser panes. Stock
  chart matches SPY762.74close and full price path in1m candles and5m line.
  Fixed shared mini-navigator zero-forced domain flattening price changes.
- ConsolidatedFlow:46trades/all33fields match across five horizontal windows.
  Fixed raw exchange code(PACF, not aliasARCA), DTE3.00, N/Aclassifications.
  Pagination100→200retains first-page aggregate statistics. Reference reload
  preserves a small aggregate discrepancy; two licensed REST probes with
  comprising details off/on and explicitIS_CANCELLED=false returned identical
  totals:CALL premium20156776822/volume16786909/tradeCount49161;
  PUT premium14146086812/volume17114367/tradeCount47792. Static source renderer
  uses same five-side sums and call-share formula as ours, but its baseline
  comes from a separate private website backend. Need exact passive private
  baseline/request evidence or provider clarification; do not fabricate parity.
- Official IVdocs conflict with actual licensed REST response. DirectSPY
  consolidated probe returned10.2519989013672, not0.1025. Preserve existing
  percentage-point presentation10.25%; do NOT blindly multiply by100. See
  docs/GEX-DATA-REST-CONTRACT-AUDIT.md for all20endpoint schema reviews.

## Earlier Net Drift evidence

Current continuation reached every catalogue row through Max Pain/Time in order.
Exposure Forecast reference shows real MVC/call wall/put wall/zero-gamma and
forecast summary, while our adapter is unavailable. No documented licensed
forecast endpoint is connected; this remains a genuine functionality blocker,
not a completed forecast. No generated replacement was added.

Reference ETF snapshot terminal06:15Brisbane is the session-close latest/unpin
control, not a missing20:15 source OHLC bar. Source evidence and a dated verified
SPY/QQQ/IWM calendar now distinguish that terminal control from interior
completed-minute requests. No source values or missing minutes are fabricated.
Unknown/index instruments retain actual source extent; do not assumeETFhours.

Browser acceptance: final completed-minute06:14selection retainsMVC763/spot762.74;
Latest selects06:15close without an invented20:16snapshot. Both labels match
the reference. Snapshot unit/integration tests cover DST, holiday, early-close,
unknown-calendar and wrong-date cases.

NetDrift drilldown now uses the documented unconsolidated endpoint, preserving
the parent's ticker/expiry/moneyness/filter-expression and exact selected-minute
range. Reference6:03AMOct17Brisbane comprising trades: all25visible rows/all32
fields match the licensed public individual-print response after correcting
millisecond display.100prints/page with cursor pagination; not a claim that
the first page equals all contributing prints or the private cliff selection.
No print-price, premium, Greek or source timestamp is synthesized.

Verification this continuation:154focused integration/reference tests PASS;
26account-budget tests PASS; scoped ESLint PASS; full Next production build
PASS84pages. Budget server wiring is source-only until an explicitly safe
gateway rollout; no gateway restart or transport changes were made here.

Catalogue scope caveat: the22 rows above inventory our current catalogue, not
the full reference catalogue. Reference tabs visibly include Unconsolidated
Order Flow, Net Flow and Volatility Skew, absent from our22-tool add menu.
These are additional catalogue parity gaps, not accepted tools. Current public
API docs now list an unconsolidated order-flow endpoint; investigate that
supported route for Net Drift composing trades instead of assuming consolidated
largest-first results are equivalent. No private session credential reuse.

Observed in the owner's two signed-in in-app browser tabs, October 19 UTC /
October 20 Brisbane. Reference https://v3.quantdata.us/ and production GEX DATA.

1. Initial settings were not identical: ours had ITM selected; reference had
   all moneyness. Switched ours to All for comparison, blank expiry/strike,
   SPY, 1-minute aggregation, net premium/bands hidden and underlying shown.
2. Reference itself had stale flow/drift values until one reload. Old captured
   console 401 entries preceded that reload; they do not establish a current
   authentication outage. After reload, reference trades and totals advanced.
3. Initial current-session snapshots were close but not simultaneous:
   reference calls16.33M / puts9.61M, ours16.18M /9.75M, both spot768.51.
   This is NOT evidence of an arithmetic defect or an exact live parity pass.
4. Pinned both tools to completed session **2026-10-16**, SPY/all moneyness.
   Both visible legends read **calls -$16.41M, puts $64.76M, spot $762.74**.
   Reset our saved cropped window to full session. Premium curves and lower
   cumulative signed-volume shape visually align. Theme colours intentionally
   differ (owner's monochrome KwantDesk theme); clocks differed by timezone.
   This validates rounded headline values and shape, NOT every raw bucket or
   composing-trade total. No sign flips, multipliers or offsets were added.
5. Licensed local-gateway current-session Net Drift diagnostics returned200,
   epoch-ms buckets with real premarket values. RTH clipping was tested as a
   diagnostic only and did not explain the earlier stale reference values.
   Payloads/secrets were not committed. Preserve real premarket data.

## Confirmed faults and changes

- Every successful refresh destroyed/recreated the canvas. Net Drift now
  replaces revised/re-fetched cumulative rows in the existing canvas for an
  unchanged request/presentation and compatible timeline. Appended buckets
  extend the navigator without replacing its controls. Full view grows; a
  cropped tail follows; a fixed historical viewport stays fixed. Changed
  filters/session, inserted/missing buckets, timezone or empty results can
  still take the explicit full-render path. No API cadence/math changes.
- Page/global historical-date overrides previously kept polling because the
  scheduler checked only the hidden local mode. Scheduler now checks the
  effective requested session date and safely pauses invalid filter requests.
- Net Drift underlying legend now uses the actual plotted price colour.
- Live production acceptance caught another rebuild path: host storage writes
  echo into child frames. Preference handlers now skip unchanged filter and
  presentation signatures, but still apply genuine theme/configuration/filter
  changes. Isolated browser QA with real parent localStorage echo settled
  confirms canvas and navigator identity remain unchanged after the save timer.
- Added7 tests; focused/integration/reference suite **107/107 passes**.

## Confirmed live-cadence gap — NOT fixed

- Measured visible legend values at1-second sampling,14:39:13.575–14:39:20.886
  UTC October19: reference changed at samples15.698,17.776 and19.849 (~2s),
  while our displayed values stayed unchanged through that7.3s window. This
  confirms an observable mismatch; it does not establish a1ms source cadence.

- Client floor30s; current response route cache15s; gateway default cache10s.
  Catalogue Net Drift12s and flow6s settings are overridden by that floor.
- Official [rate limits](https://quantdata.us/api/docs/rate-limiting): shared
  240 requests/minute/user across keys/endpoints; public streaming is listed
  Coming Soon. Runtime limit/reset/retry headers are authoritative.
- Official [Net Drift schema](https://quantdata.us/api/docs/endpoints/net-drift):
  bucket amounts must be cumulatively recomputed, including revised buckets.
- A paid REST key does not establish entitlement to the website's private
  stream. Do NOT promise1ms/1s parity, copy browser session credentials into
  backend, or raise all browser polling through Vercel to simulate streaming.
- Need supported provider real-time API/stream entitlement and gateway-side
  shared acquisition/fanout to verify the actual target cadence safely. VPS
  alone does not remove the provider quota. Owner still chose wait for Vultr;
  no new accounts, paid services, tunnels or DNS changes authorized.
- Net Drift drilldown currently uses consolidated largest-premium-first trades
  (100/page) while its filter-group schema is unconsolidated. Must reconcile
  the reference composing-trade semantics before claiming trade-level parity.

## Standing unresolved items

Supported permanent transport (wait for Vultr); full rolling-month futures /
options history; missing Asia opening tape; weekly/profile/footprint live soak.
This audit does not close those or the remaining21 tool acceptance gates.

Release: commit bbc99a10357cc2ae955a0b0ae0476f136dc9ce9d,
production dpl_A1Rqvx9mKzjALJPir2AqYsSxh9H4 READY; uncached live diagnostics
returns the same exact commit. This releases the scoped refresh fixes, not
complete tool/data/live parity.

Corrective release dad8de0aaa6d671f270e2ec2d83cab5d2628640a /
dpl_BwMLhXKoVZUpk7wrdN14hGnUGyG7 is READY, exact live SHA confirmed.
Production app.js?v=6 retained navigator focus and cropped end170 over a real
refresh14:47:51.973–14:48:33.687UTC while legend values advanced with no visible
error. Full-session view restored afterward. Scoped continuity acceptance
passes; cadence/bucket/trade/library parity remains incomplete.
