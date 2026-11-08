# Options VWAP: implementation and data coverage

## Outcome

Options VWAP is implemented as an underlying-price line weighted by captured option contracts. It is explicitly an observed-contracts study. The original requirement for a complete market VWAP and complete week of history is NOT established by the present sampled source. Do not remove the coverage disclosure or describe this as complete OPRA coverage.

No premium-weighted/futures-volume/equity-volume proxy is used. The owner was asked whether the intended plot was underlying-price or individual option-premium VWAP; no answer arrived during implementation. The stated working assumption is underlying price weighted by option contracts, on options-underlying charts.

## Calculation and controls

- Formula: sum(reported underlying price × executed option size) / sum(executed option size).
- Exact ticker, calls plus puts / calls only / puts only; New York day or Monday-week reset; line width, colour, theme colours and current value.
- Missing underlying prices, invalid sizes, child rows and cancellations are excluded. Stable execution IDs deduplicate repeated snapshots; known cancellation references remove their original print.
- Each point uses only executions before its chart bucket ends. Replay additionally excludes records received after its clock. No future snapshots substitute for missing observations.
- All loaded chart timestamps participate, rather than the short moving-average window. Options charts can look back through available recordings. Calculations are independent of host OHLC volume and price; host candles supply time coordinates only.
- Weighted curves are cached by immutable tape and settings so normal price ticks do not repeatedly sort/rebuild options history.
- One catalogue entry, settings persist in workspaces; unsupported futures and volatility-index hosts are blocked. SPXW is not silently replaced with all SPX contracts when no separately labelled executions exist.

## Delivery and costs

Owned captures are read by the existing private auxiliary history service, isolated from the main gateway. Closed files reuse a bounded compact-record cache by file size/mtime; the raw Greek-heavy snapshots are not retained in memory. Cold preparation returns HTTP202 within1.5seconds and continues separately. Archive errors cannot trip the live feed's shared origin breaker.

Browser readers share requests for matching ticker/range/mode. ETags return304 for unchanged records. Hidden tabs slow down; completed dates use a five-minute refresh. Live dates reuse the EXISTING shared consolidated options-flow subscription, with a15second floor when Options VWAP is its only subscriber. Existing Big Blocks subscribers retain their prior cadence. No new vendor credential, service purchase, plan change, main gateway/terminal restart, order/account mutation or owner-tab refresh.

This source supplies latest100 consolidated rows per refresh, not every market execution. Consequently a constantly moving futures price does not imply a new recorded options VWAP value. Live-only behaviour could not be observed in an open cash session during this Sunday release; synthetic delivery/deduplication was tested instead.

## Actual November2–6 recording check

The initial bounded read found SPX10003 records, NDX892, QQQ8841 over all five weekdays; SPY2222 over November2 and4. These are sampled counts, not market totals. Subsequent cancellation handling can reduce the retained count.

Coverage is always complete:false. The November1 and6 storage folders had incomplete compressed captures; the November5 file exceeded the reader's32MiB compressed-file guard. Per-file decoded scanning is bounded to64MiB and retained compact records to100000. Missing sessions in this response are NOT proof that no data exists elsewhere on disk: large captures still require a dedicated full indexing/recovery job. Do not invent a line to fill those gaps. A complete unfiltered options execution source/recorder and verified full archive coverage are still required for an authoritative full-market benchmark.

Cold first-symbol read measured21.3seconds before adding the nonblocking preparation receipt; subsequent ticker reads reused parsed files in207–495ms. Those timings are archive probes, not browser tick-latency promises. HTTPS private route returned200 and unchanged-ETag304. No paid provider calls were made during these closed-date probes.

## Verification

31 focused tests passed: exact weighting, volume-source independence, calls/puts, session/week resets, timezone/replay cutoff, cross-timeframe equivalence, shared readers, live/archive ID deduplication, saved settings, compatibility, archive deduplication, invalid query bounds, auth, conditional reads and existing Big Blocks behaviour.

Actual isolated Chart browser fixture: two options charts, one archive request,18 canvases, no page errors; historical fixtures make no vendor calls. Scoped helper lint passed. Full production webpack build and exact production commit/route activation must be confirmed in the release receipt. Tests do not certify full-market data coverage.

Operator routing: Caddy forwards only /v1/market-data/options-vwap to heat-cell-history:8798. The auxiliary service alone was restarted; the live market gateway and provider subscriptions were untouched. Pre-change Caddy/server copies remain on the VPS with before-options-vwap-20261108 names.
