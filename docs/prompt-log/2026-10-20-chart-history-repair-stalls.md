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
