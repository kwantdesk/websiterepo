# GEX DATA REST contract audit — 2026-10-20

## Scope and acceptance boundary

Source/schema audit of the 20 official REST endpoints behind the current 22-tool
GEX DATA catalogue. Market Share Table shares the Market Share endpoint;
Exposure Forecast has no connected REST adapter. This is not a claim of live
numerical, visual, update-cadence, or full-workspace parity with the reference.
The main engineer owns sequential signed-in browser acceptance and release.

Read-only official documentation was checked on 2026-10-20. Existing source
models were inspected without opening new provider connections. The main
engineer supplied the specific licensed gateway IV observation recorded below.
No credentials or raw customer records are stored here.

Status **SCHEMA REVIEWED** means the documented response/input contract was
compared with implementation. It does not mean **LIVE PASS**. Request/pagination
findings below are findings against the inspected baseline; the main workstream
owns fixes and their eventual verification.

## Catalogue-order checklist

All endpoint paths below are POST requests beneath `/v1`; browser requests must
remain behind the existing authenticated shared gateway. No direct vendor calls
or credentials belong in frames.

| # | GEX DATA tool / official endpoint | Contract and assessment | Status |
| --- | --- | --- | --- |
| 1 | [Dark Flow](https://quantdata.us/api/docs/endpoints/dark-flow), `equities/tool/dark-flow` | Required single ticker. Session or time range, optional aggregation. Bucket notional is dollars; size is shares; trade count is prints; stock price is underlying close. No filter expression. Current chart uses actual bucket notional rather than invented cumulative inventory. | SCHEMA REVIEWED; live comparison outstanding |
| 2 | [Dark Pool Levels](https://quantdata.us/api/docs/endpoints/dark-pool-levels), `equities/tool/dark-pool-levels` | Required ticker and inclusive session-date range. Only that range and ticker are accepted; no sessionDate, snapshotTime, timeRange or aggregation. Baseline request builder retained sessionDate from requestBase when adding the range: confirmed request defect reported to main. Price keys and notional are dollars; size is shares. Model selects notional top N before display sorting, matching existing source-backed tests; do not reinterpret that as top-N by another metric without reference evidence. | SCHEMA REVIEWED; baseline request defect identified; live acceptance outstanding |
| 3 | [Equity Prints](https://quantdata.us/api/docs/endpoints/equity-prints), `equities/tool/equity-prints` | Cursor-paginated array, default tradeTime descending, maximum100 rows/page. Price/notional dollars, size shares, canonical tradeSide and printType. Current explicit table schema preserves those units. No statistics block. | SCHEMA REVIEWED; full live tape/cursor comparison outstanding |
| 4 | [Exchange Notifications](https://quantdata.us/api/docs/endpoints/exchange-notifications), `equities/tool/exchange-notifications` | Cursor-paginated id/ticker/type/createdTime records. No aggregation or snapshotTime. Filters limited to ticker/type and supported expression fields. Current time column uses createdTime, not tradeTime. | SCHEMA REVIEWED; live notification comparison outstanding |
| 5 | [Market Map](https://quantdata.us/api/docs/endpoints/market-map), `equities/tool/market-map` | Session or snapshotTime, mutually exclusive; no timeRange/aggregation. Company snapshots contain currentValue, previousValue and dollar market capitalization in size. Sector/industry filters accepted. Existing model uses actual capitalization for treemap weighting. | SCHEMA REVIEWED; snapshot/pixel comparison outstanding |
| 6 | [Stock Price / Time](https://quantdata.us/api/docs/endpoints/stock-price-over-time), `equities/tool/stock-price-over-time` | Required ticker, session or time range, aggregation. Dollar OHLC only, no volume. parsePriceRows/priceChartPresentation must not manufacture a stock-volume pane. | SCHEMA REVIEWED; bar-for-bar live comparison outstanding |
| 7 | [Consolidated Order Flow](https://quantdata.us/api/docs/endpoints/order-flow-consolidated), `options/tool/order-flow/consolidated` | Paginated trade array; includeComprisingTrades and includeStatistics are opt-ins. Statistics appear only on the first page. Baseline append preserved rows but not the first-page statistics while resetting the stage: confirmed header-loss defect reported to main. Premium already dollars; quantity contracts. IV runtime/documentation conflict below. | SCHEMA REVIEWED; baseline pagination defect identified; live table comparison outstanding |
| 8 | [Contract Price / Time](https://quantdata.us/api/docs/endpoints/option-price-over-time), `options/tool/option-price-over-time` | Exactly one OSI identifier OR all ticker/expiry/strike/call-put fields; mixed identifiers rejected. Session/time range/aggregation. Dollar OHLC plus contract volume. No underlying-price field; only join an explicitly fetched matching underlying series. No expression filter. | SCHEMA REVIEWED; contract/candle comparison outstanding |
| 9 | [Contract Side Statistics](https://quantdata.us/api/docs/endpoints/contract-trade-side-statistics), `options/tool/contract-trade-side-statistics` | dataMode required: PREMIUM, VOLUME or TRADE_COUNT. Response contractType→canonical side→selected metric only. MID_MARKET is the wire name; short forms are input aliases. Model proportions and money flag use selected metric. Earlier MID-alias concern is not a documented response defect. | SCHEMA REVIEWED; side totals comparison outstanding |
| 10 | [Contract Statistics](https://quantdata.us/api/docs/endpoints/contract-statistics), `options/tool/contract-statistics` | CALL/PUT aggregates for all matching trades, absent empty legs. Premium dollars, volume contracts, count executions. Current model reads these totals directly; zero-safe proportions do not reconstruct totals from visible table pages. | SCHEMA REVIEWED; cross-tool totals comparison outstanding |
| 11 | [Gainers / Losers](https://quantdata.us/api/docs/endpoints/gainers-losers), `options/tool/gainers-losers` | Per-ticker totals; premiumRatio is bearish/bullish, zero if bullish is zero. Current model uses that formula, retains raw premium and derives dataset fractions. Response alphabetic ordering is separate from selectable UI rank. | SCHEMA REVIEWED; sorted values/rounding comparison outstanding |
| 12 | [Market Share](https://quantdata.us/api/docs/endpoints/market-share), `options/tool/market-share` | Nine per-exchange fields: equity calls, equity puts, index × premium/count/volume. Equity total adds both equity legs; total adds index. Current models use these components without double-counting an ALL row. | SCHEMA REVIEWED; exchange/group parity outstanding |
| 13 | Market Share Table | Same endpoint as row12, not a distinct provider request contract. Derived totals/percentages remain separate from provider fields. | SCHEMA REVIEWED; table parity outstanding |
| 14 | [Exposure by Expiration](https://quantdata.us/api/docs/endpoints/exposure-by-expiration), `options/tool/exposure-by-expiration` | Required ticker, Greek and representation. Session or snapshotTime. Ticker→exposureMap→expiry→strike→optional call/put exposure. Current rollup sums signed legs by expiration without dividing dollar-scaled REST values by100. | SCHEMA REVIEWED; exact snapshot/units comparison outstanding |
| 15 | [Exposure by Strike](https://quantdata.us/api/docs/endpoints/exposure-by-strike), `options/tool/exposure-by-strike` | Same response shape, strike aggregation; signed leg values depend on Greek and units. Net exposure adds signed call and put values; split mode retains each. Current model does this; do not subtract an already-negative put. | SCHEMA REVIEWED; exact snapshot/units comparison outstanding |
| 16 | Exposure Forecast | No connected endpoint in current catalogue (`endpoint:null`). Explicit unavailable state is truthful, not a working forecast or parity completion. Do not synthesize a forecast from present exposure. | UNAVAILABLE ADAPTER; not LIVE PASS |
| 17 | [Heat Map](https://quantdata.us/api/docs/endpoints/heat-map), `options/tool/heat-map` | Required ticker/dataMode. Eight paired modes plus19 per leg =46. Response contract cells carry callValue/putValue; single cells carry value. Current metadata covers all46; Greek exposure adds signed legs, non-exposure net metrics subtract legs. IV unit scaling requires runtime evidence, not a blanket change. | SCHEMA REVIEWED; all-mode snapshot and display comparison outstanding |
| 18 | [IV Rank](https://quantdata.us/api/docs/endpoints/iv-rank), `options/tool/iv-rank` | Required ticker/lookBackPeriod/maturity; both periods1..365. Only optional contractTypes; no sessionDate/timeRange/filterExpression. Fractional last/min/max IV inputs. Rank uses (last−min)/(max−min); combined-leg averaging is an existing reference presentation rule, not a separate REST rank field. | SCHEMA REVIEWED; reference averaging and live values comparison outstanding |
| 19 | [Interval Map](https://quantdata.us/api/docs/endpoints/interval-map), `options/tool/interval-map` | Required ticker/Greek; session or time range and aggregation. Bucket→expiry→strike→CALL/PUT signed exposure; optional expiry and min/max strike. No expression filter. Existing source-backed fold retains last known cells across sparse updates; docs alone do not prove omission/reset semantics. | SCHEMA REVIEWED; sparse-update/live movement comparison outstanding |
| 20 | [Max Pain](https://quantdata.us/api/docs/endpoints/max-pain), `options/tool/max-pain` | Required ticker/expiry, optional session only; no snapshot/timeRange/aggregation/expression. Dollar intrinsic-value cells and provider maxPainStrikePrice/stockPrice. Display provider marker; do not replace it with speculative formula based on ambiguous wording in documentation. | SCHEMA REVIEWED; marker/expiry comparison outstanding |
| 21 | [Max Pain / Time](https://quantdata.us/api/docs/endpoints/max-pain-over-time), `options/tool/max-pain-over-time` | Required ticker, optional session. Response expiry→dollar strike. Horizontal dimension is expiration date, not intraday time. Empty map is valid no-data, not proof of a broken connection. | SCHEMA REVIEWED; expiry values comparison outstanding |
| 22 | [Net Drift](https://quantdata.us/api/docs/endpoints/net-drift), `options/tool/net-drift` | Incremental bucket premiums/volumes must be accumulated in timestamp order anew on refetch. Current calls/puts/net and cumulative signed-volume model follows this. Latest bucket revises. Stock price only guaranteed for single ticker. Existing confidence-band and leading-missing-spot behavior needs source/runtime comparison; see below. | SCHEMA REVIEWED; live numbers/drilldown/bands/cadence acceptance outstanding |

## IV: observed runtime takes precedence over conflicting documentation

The official [field reference](https://quantdata.us/api/docs/field-reference)
describes IMPLIED_VOLATILITY as fractional. The main engineer's licensed gateway
observation on 2026-10-20 returned the following sanitized evidence:

- Endpoint: `options/tool/order-flow/consolidated`.
- Request: session 2026-10-16, ticker SPY, size 1.
- Record: CALL 766, expiration 2026-10-19, optionPrice 1.62,
  tradeTime 1792181695487, impliedVolatility 10.2519989013672.
- Observed payload uses percentage points; correct display is 10.25%, not 1025.20%.

Keep `CONSOLIDATED_COLUMNS.impliedVolatility` as `percentagePoints`. Do not infer
units from magnitude or silently alternate scaling per row. Existing
table-view regression now includes this observed value alongside earlier
11.301040649414062/15.4972 cases. The generic percentage formatter can handle
fractional fields where their contract really is fractional; it is not the
consolidated column's formatter. IV Rank's separately documented fractional
inputs remain a separate contract. Heat IV has an existing runtime-points
comment and requires its own observed response before any conversion change.

## Model and interpretation confidence limits

- `options-models.js:netDriftRows` computes running calls/puts, net=call−put,
  and running signed callVolume−putVolume. Official Net Drift docs explicitly
  require recomputing running sums from changing buckets. Keep full precision
  until formatting; do not repeatedly sum the same complete refresh into old
  state.
- Confidence widths accumulate real mid-market premium inputs in the imported
  vendor-source model. Current REST docs call these per-contract closing
  premiums while also discussing cumulative fields generally. That wording
  alone is not enough to rewrite the reference's confidence bands or claim
  their parity. Leading missing-stock preprocessing also requires reference
  confirmation before changing running totals.
- Net Drift detail currently uses consolidated actual trade rows, whereas its
  attached filters are classified as unconsolidated. Shared field aliases make
  many expressions valid on both, but that does not prove equal consolidation,
  selection or reference cliff-endpoint behavior. A100-row premium-sorted page
  is not a reconciliation of every execution in the clicked bucket.
- Consolidated header statistics sum every side for call/put totals. Sentiment
  excludes mid-market and combines calls bought/puts sold as bullish and the
  reverse as bearish. Existing source presentation labels call trade share
  “Put / Call Ratio”; do not silently change that to putCount/callCount without
  the reference comparison. A source-matching label can still be unintuitive.
- Models use licensed REST dollars directly. Stock OHLC and option OHLC remain
  distinct. Unavailable Greeks, forecast, stock volume or missing underlying
  overlays must never be invented for visual similarity.

## Refresh, filtering and rate constraints

Official [conventions](https://quantdata.us/api/docs/) accept singular/plural
collection field aliases and scalar/array forms; ticker versus tickers alone
is not a schema defect. [Filter expressions](https://quantdata.us/api/docs/filter-expression)
support nesting to depth 5 and 100 total terminals; convenience filters and
expressions combine with AND. These rules do not make an unsupported field
or unsupported endpoint expression valid.

The official [rate-limit contract](https://quantdata.us/api/docs/rate-limiting)
currently describes a shared per-user 240 requests/60 seconds and 20/second burst
budget across keys and endpoints, with runtime headers authoritative. All
endpoint docs still show streaming as Coming Soon. A paid REST entitlement
does not prove the dashboard's private stream or permit unbounded millisecond
polling. Preserve shared ingestion/coalescing and Vercel cost protection.

Baseline browser polling floor30seconds, Next live cache15seconds, gateway
default cache10seconds/350ms request spacing were identified separately by
source inspection. Every successful baseline refresh recreated the chart via
renderToolPayload→resetStage. Main workstream owns freshness/repaint changes;
these baseline constraints are not a recommended target or release claim.

## Verification

- `node --test tests/gex-data-reference/*.test.mjs`: 81/81 passed after adding
  the representative IV assertion (282.6ms reported test duration).
- Additional IV assertion extends an existing test; it is not a new passing
  live-tool count. No pure-model conversion changed.
- Models, fixtures and source-backed rules are not independent live parity
  evidence. Every LIVE PASS remains dependent on matching instrument, session,
  aggregation, filters, units and source timestamp in both browser surfaces.
