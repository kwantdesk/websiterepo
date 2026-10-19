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
| Dark Flow | Not audited live | All gates |
| Dark Pool Levels | Not audited live | All gates |
| Equity Prints | Not audited live | All gates |
| Exchange Notifications | Not audited live | All gates |
| Market Map | Not audited live | All gates |
| Stock Price / Time | Not audited live | All gates |
| Consolidated Order Flow | Not audited live | All gates |
| Contract Price / Time | Not audited live | All gates |
| Contract Side Statistics | Not audited live | All gates; check MID / MID_MARKET schema alias |
| Contract Statistics | Not audited live | All gates |
| Gainers / Losers | Not audited live | All gates |
| Market Share | Not audited live | All gates |
| Market Share Table | Not audited live | All gates; shares endpoint with Market Share |
| Exposure by Expiration | Not audited live | All gates |
| Exposure by Strike | Not audited live | All gates |
| Exposure Forecast | Unavailable | No connected licensed endpoint; never fabricate a forecast |
| Heat Map | Not audited live | All gates |
| Implied Volatility Rank | Not audited live | All gates |
| Interval Map | Not audited live | All gates |
| Max Pain | Not audited live | All gates |
| Max Pain / Time | Not audited live | All gates |
| Net Drift | IN PROGRESS — partial numerical/visual pass | Exact buckets, composing trades, cadence and full live/interaction acceptance |

## Net Drift evidence

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
- Added6 tests; focused/integration/reference suite **106/106 passes**.

## Confirmed live-cadence gap — NOT fixed

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
