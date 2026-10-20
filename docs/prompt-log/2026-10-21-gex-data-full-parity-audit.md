# GEX DATA: complete catalogue audit, 2026-10-21 Brisbane

## Request and acceptance

Compare every existing GEX DATA tool against the signed-in Quant Data browser,
matching instrument, session, aggregation, units, filters and viewport. Repair
proven faults, then verify. Inspection is not a complete numerical/live pass.
This record supplements, rather than overwrites, `docs/GEX-DATA-PARITY-CHECKLIST.md`.

## Proven repairs in this release

1. Interval Map no longer creates carried exposure observations at stock-only
   timestamps. Exposure snapshots come exclusively from the provider's actual
   interval updates; the underlying is an independent series on the shared
   timeline. Tooltip joins cannot borrow a future price or one older than one
   minute. Explicit zero/missing-leg semantics remain unchanged.
2. Rebuilt charts retain the full-session opening window when new data arrives.
   Cropped tail views follow the tail; inspected earlier windows stay fixed.
   Another ticker/session/aggregation/request cannot inherit unrelated indices;
   inserted historical timestamps invalidate incompatible saved windows.
3. IV Rank rejects null, empty, boolean, object and nonfinite inputs instead of
   converting unavailable values to zero and manufacturing a rank.
4. Fractionally zoomed Net Drift premium, bands, underlying and volume are
   clipped to their respective plotting panes, not drawn into axes.
5. A failed ticker/session/filter/snapshot change clears the previous selection's
   visual. Reproduced on the live site: SPY controls above the old QQQ Heat Map
   after a failed read. Same-query background refreshes still retain usable
   data; no recurring loading cover is introduced.

Static module entry/import versions are updated. No provider signs, multipliers,
offsets, smoothing or fabricated forecasts are introduced. No refresh-rate,
Vercel-cache, gateway process, credential or provider-session changes are made.

## Complete tool inventory and evidence ledger

All 22 source transformations were inspected. The browser was stepped through
all 22 tools individually. Most comparisons use completed session 2026-10-16;
rolling IV and Forecast have different availability, explicitly noted below.
The earlier ledger's deeper row captures remain separate evidence—not fresh
live acceptance. A sampled/rounded match does not certify every raw bucket.

| # | Tool | This audit's evidence / result | Remaining acceptance |
|---|---|---|---|
| 1 | Dark Flow | SPY Oct16 notional $23.44B and spot $761.10 agree. Bucket-notional, not cumulative inventory. | Exact per-bucket/live cadence. |
| 2 | Dark Pool Levels | Matched SPY Oct16 Top10; all ten displayed prices/notionals/counts/volumes and fractions agree. Top50 deeper capture retained in earlier ledger. | Additional filters/live cadence. |
| 3 | Equity Prints | Matched full-market Oct16 tape. MU1500@$875.70, QQQ1560@$707.91 and SKHY7316@$136.89 agree. NY vs Brisbane date/time conversion explains different clock labels. | All pages and live arrival latency. |
| 4 | Exchange Notifications | Matched Oct16 LUDP, 46 rows; CHWM/FVN/CTSO leading events and clock conversions agree. All-events is a different population. | Remaining event combinations/live latency. |
| 5 | Market Map | Same Oct16 returns (NVDA−1.38%, AAPL+0.48%, AMZN−1.86%, etc.); matched Industry rather than comparing Sector against Industry. | Entire universe, minute slider and live changes. |
| 6 | Stock Price / Time | Matched SPY Oct16 5m Line, close $762.74. | Full raw OHLC/bucket/live cadence. |
| 7 | Consolidated Order Flow | **FAIL:** identical session/full-market filters still produce reference50.70%,17.09M/16.72M,$14.11B/$20.11B vs REST50.71%,17.11M/16.79M,$14.15B/$20.16B. Leading actual trades agree. | Resolve private-site vs licensed-REST population; never offset totals. |
| 8 | Contract Price / Time | Matched SPY expiryOct19 strike766 PUT, Oct16 1m: contract$4.80, underlying$762.74 agree. | More contracts, raw OHLC/volume and live cadence. |
| 9 | Contract Side Statistics | Full-market premium totals $31.90B calls/$26.17B puts observed; reference also had ITM/TradeCount saved. Source accumulation/proportions verified. | Finish matched ITM numeric check; all metrics/live cadence. |
| 10 | Contract Statistics | Matched AboveAsk+Ask: put/call premium$11.24B/$17.16B, volume21.77M/22.27M, count3.17M/3.31M and percentages agree. | Other combinations/live cadence. |
| 11 | Gainers / Losers | Technology selection matters. MU895.10M/799.88M, NVDA457.91M/411.05M, AMD410.55M/368.11M bearish/bullish samples agree. | Full current population; all-market aggregate gap remains in earlier ledger. |
| 12 | Market Share | Matched TotalPremium/ExchangeGroup/Bar. MEMX1.17B(2.02%),BOX1.47B(2.52%),MIAX4.70B(8.09%),UNKNOWN51.30M(.09%),NYSE6.36B(10.96%),NASDAQ9.83B(16.92%) agree. | All nine measures/exchanges/live cadence. |
| 13 | Market Share Table | 20 exchange rows plus pinned TOTAL/ALL footer, not a missing21st row. Exact leading numeric fields and totals agree: equity calls44,708,751, puts40,363,239; premiums14,784,513,408/13,579,011,128; total58,064,218,776. Earlier357-cell capture retained. | All filter/live cases. |
| 14 | Exposure by Expiration | Matched SPY Delta/Per$1Move, netDEX−37.65B agrees. | Every expiry/Greek/unit/snapshot, live cadence. |
| 15 | Exposure by Strike | Matched SPY Gamma/Per1%Move/Split controls; intermittent request failure prevented fresh completed comparison. Earlier NET−28.93B capture retained. | Recover then recheck split values/window, all modes/live cadence. |
| 16 | Exposure Forecast | **BLOCKED:** local adapter explicitly disconnected (`endpoint:null`); reference has real forecast probabilities/levels. | A supported licensed forecast source is required; no proxy from unrelated GEX/price. |
| 17 | Heat Map | First SPY read failed and left QQQ visible (repaired above). Exact retry recovered SPY MVC$763/Oct16 and spot$762.74. 46 metric definitions/source signs inspected. | Every cell/mode/snapshot and live cadence. |
| 18 | Implied Volatility Rank | SPY365-day/30-day; reference Call22.09% observed. Combined/Call are different series. Null-input rank defect repaired. | Matched current Call value/timestamp plus complete rolling series. |
| 19 | Interval Map | SPY Oct16 5m/Gamma/5-strike padding, spot$762.74. Synthetic-timestamp/future-price defects proven and repaired. | Post-release visual check, raw updates/Difference/all Greeks/live cadence. |
| 20 | Max Pain | Matched SPY Oct19 expiry, Oct16 session; marker$773 and underlying$762.74, curve agree. | All strikes/expiries/live cadence. |
| 21 | Max Pain / Time | Reference curve has820peak/725trough. First matched SPY read failed; exact retry pending at release preparation. | Recover and compare complete curve; live cadence. |
| 22 | Net Drift | Matched SPY Oct16/1m/All: calls−16.41M,puts64.76M,spot762.74 agree. Both full timelines visually agree after removing reference navigator crop. Original saved local board was QQQ/NDX OTM with cropped views—not the same query. | Raw bucket/print populations, revisions, all filters, precise live cadence. |

## Source-backed semantics and unresolved delivery

Fresh inert reference main/worker artifacts from Oct18 were inspected, not
executed. Main SHA2568288af19732566bce751c987d29f3a42af48c1ab5d2f326c204ce454db0933d4;
worker38b2ba5a83626da33806acc8467138be1e93377efc16ed7edc5993984adfa7ce.
Worker25486–27000 (UTF-16 offsets) builds actual exposure timestamps separately
from stock observations. Worker31180–32800 confirms Net Drift accumulation,
signed volume, cumulative mid-market confidence widths, and leading-zero-spot
preprocessing. Do not change those formulas based solely on differently cropped
screenshots. Static equivalence does not prove current raw-source equality.

The current client still floors refresh at30s, Vercel live cache15s, gateway
default cache10s. Earlier observed reference cadence was roughly2s. The host
only supports same-origin Vercel requests; the gateway has no supported scoped
browser vendor grant/CORS path. Exposing the static gateway bearer is forbidden.
20 distinct tools polling every2s would require~600requests/minute before other
consumers, beyond the recorded shared240request/minute entitlement. Shared
gateway acquisition/fanout and supported provider real-time access are required;
changing a frontend timer is not parity and would increase Vercel spending.

Intermittent HTTP delivery is separately observed: several exact retries recover.
One bounded diagnostic read returned the same100-row archived equity payload
via local gateway, current Quick Tunnel and existing Funnel (200,26975bytes),
without creating a new provider connection. This does not establish a stable
production-Vercel path. Supported permanent transport remains unresolved.

## Verification / release

- 125 focused/reference/request-contract tests pass (Node strip-types + existing
  alias hook); includes executable real-function stale-query regression,
  sparse/zero/missing/future/stale interval tests, independent-series rendering,
  viewport rebuild/query isolation and actual plot clipping.
- `node --check public/gex-data-app/app.js` passes.
- Scoped `git diff --check` passes.
- No heavy local Next build during the owner's trading session.
- Production deployment and post-release browser receipts to be appended after
  the single scoped main push. Do not mark every tool accurate/live-certified.

Temporary audit page/global filters must be cleared and original owner layout
preserved after comparison. Reference pane maximize/date/navigation changes are
test state, not requested permanent workspace changes.
