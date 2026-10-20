# Repeated chart hangs: bounded history repair

## Evidence and scope

Owner reports hanging every few seconds. Read existing live Charts and GEX VUE
tabs without clearing settings, disabling indicators or restarting the gateway.
Charts has daily/weekly profiles, CVD, Big Contracts, Delta Bar and VWAP enabled.
No console warning/error in the inspected GEX VUE tab. Production telemetry on
deployment dpl_F9X9KfSoguCaSgUSkFkqtcEmPhXk records repeated Charts stall profiles
at 13:44–13:45 UTC, including 3151, 6467 and 8088ms windows. Most profiler samples
are stackless/idle, so those windows are NOT all attributed JavaScript CPU time.
The leading named frames resolve in the exact deployed public chunks to candle
normalization/merging, timeframe parsing and the tail-reconciliation callback.
This establishes active expensive history work, not a complete CPU diagnosis.

## Change

Incomplete tail recovery previously forced full history retrieval, normalization,
merging and cache work every two seconds indefinitely. Add one per-pane repair
gate: single in-flight repair, 2/4/8/16/30s failure backoff (30s cap), reset on
verified success. All scheduling paths share one cancellable timer. Existing
effect abort/cleanup remains. Repair fetch uses the existing non-persisting
heal read; cache only its verified successful merged result once, rather than
persisting an unverified download before also merging it locally.

No candle/flow calculations, signal thresholds, execution events, live-stream
cadence or provider sessions changed. Missing data remains missing, not invented.
No new poller, external service or paid resource. Lower retry volume, not a cost
guarantee. Different timeframe panes still own separate recovery decisions.

## Validation

Seven tests pass: gate overlap/backoff/reset, production scheduling/cleanup
contract and existing cache/flow preservation/event-geometry regressions.
Gate scoped ESLint passes. Local production JavaScript compilation passed;
stopped the build during TypeScript at the owner's urgent trading interruption
to remove local CPU/memory load. Remote production build must validate types.
No full-file workspace lint claim (very large existing source).

## Open

Need refreshed live acceptance to establish total stall improvement; no promise
all hangs are fixed. Supported permanent transport/VPS, complete month futures
and options archive/continuous capture, missing Asia tape, full VP/footprint/CVD
soak, GEX DATA/KWANTY parity, non-ES/NQ exact volume adapters and 100+ user
capacity/cost gates remain open. Owner Vercel cap unchanged.

At 13:50 UTC local gateway health confirmed connected/fresh Rithmic packets but
event-loop overload, max lag9455ms, tripCount77; public history health reported
connection_failed. At13:51:40 after stopping local build, overload=false and
lastLagMs=0 with fresh packets. No gateway restart. This is transient recovery,
not proof the underlying capacity/transport fault is permanently repaired.

## Urgent NQ1m loading follow-up

Production retry-gate release e7c820f7 / dpl_CNs5yMncV3WyLRooShF4JY53n9fb
is READY, but actual NQ1m remains loading. Server logs identify repeated
cme-time-flow-v6 NQ.v.0/1m/10d/base history timeouts and one unreachable configured
origin. Current Quick Tunnel /health responds200, connected, fresh packets,
overload=false; existing Funnel health also200. Corrected the production
KWANTDESK_MARKET_DATA_GATEWAY_URL to the currently running Quick Tunnel using
the existing environment variable, no token change and no gateway restart.
This temporary address is NOT a permanent VPS fix. It must move on VPS restore.
One additional incident release is needed to pick up the corrected environment;
no manual deployment path or preview build. Actual chart acceptance remains open
until that release is verified in the browser.

The documentation-only activation was correctly skipped by the existing build
cost guard. Added a functional recovery route: only when bulk uses a temporary
Quick Tunnel, finite candle/profile/flow-level reads can fail over to the
already-configured same-collector streaming transport. Streams stay exclusively
on their unbuffered transport; vendor requests unchanged. A permanent VPS does
not inherit this desktop fallback. Seventeen env/adapter tests pass, including
primary failure/HTML rejection, routing separation and permanent-VPS exclusion.

## Loading-deadlock evidence and correction

Both routing releases reached READY, yet refreshed NQ1m still displayed Loading.
CDN logs show200 history responses. An authenticated local request at14:02:48
returned8928 real NQ1m rows, continuous recent history ending14:01:00, but
cmeChartTailNeedsReconciliation returnedtrue solely because14:02 had no forming
row. Completed history is a valid initial chart: require the last completed
bucket and recent contiguous predecessors, but not a fabricated forming row.
Live executions still join through the existing path. Missing completed buckets,
internal gaps and a lone live candle remain rejected. Three new readiness tests
pass; the existing 3m fixture expectation changes because its previous completed
bucket is present (the same fixture still correctly fails1m).
The older test-chart-history-state script fails an unchanged exact source-string
assertion about willRetry broker scoping; not claimed passed.
