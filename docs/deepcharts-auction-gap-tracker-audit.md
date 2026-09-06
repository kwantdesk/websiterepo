# Auction Gap Tracker — implementation in progress

### Direct live tape extends the compact history — 2026-09-07

Auction Gap is now a consumer of the workspace's direct exact-execution event
fan-out. The Chart-owned runtime retains one bounded worker client per active
instance; execution events update its tape by reference and candle events queue
the newest complete snapshot, so worker coalescing retains only the latest
calculation while price painting remains independent.

The study treats compact history as an immutable prefix. Once live records are
present it removes the last compact bar, reconstructs that seam bar plus every
newer time/event bar from exact executions using the established authoritative
allocators, and then joins the segments. Exact candle OHLC/volume reconciliation
must pass. A missing/compacted seam returns unavailable and the UI retains its
last proven historical frame; it never double-counts rows or flashes empty.
108 Auction Gap and 51 gateway tests, TypeScript and scoped lint pass. Explicit
live loss/coverage receipts, status UX, alerts and real browser/live-market QA
remain. Pending gate stays off; no production push/deployment.

### Validated history now paints through the real chart path — 2026-09-07

An enabled Auction Gap pane now retrieves the exact compact payload retained
for its resolved contract, timeframe and live/replay scope, hands it to the
existing dedicated worker, and updates the chart-owned Auction Gap primitive
with logical-index plot models. Primitive attachment and teardown follow the
same chart lifecycle as the existing footprint/order-flow studies.

Added a second fail-closed alignment boundary because the chart may left-trim
the provider window or append/replace its live edge after server validation.
Only a contiguous unique-timestamp overlap with exact source volume can paint;
a differing developing candle is accepted only at the trailing boundary and is
reserved for the incremental live path. 106 Auction Gap and 51 gateway tests,
TypeScript and scoped lint pass. Live continuation/receipts, unavailable-state
UX, alerts and browser QA remain, so the catalogue gate stays Pending and no
production push/deployment was made.

### Compact slices feed the existing lifecycle — 2026-09-07

Added the browser/worker adapter from validated v2 bars to Auction Gap source
segments. It classifies every minute through the exchange-aware/DST-safe clock,
groups adjacent slices by reset key, keeps all raw rows for subsequent retest
evidence, and applies ETH/RTH/custom filtering only to detection rows. A reset
inside one long chart candle becomes two ordered segments sharing its true
chart index, so extension logic still counts chart bars rather than minutes.

The existing pure study pipeline can now seed from compact history with no raw
execution reconstruction. Adapter, whole-study and retained-session tests,
TypeScript and scoped lint pass. Workspace-to-Chart worker/primitive wiring,
event live continuation, live coverage receipts and browser QA remain. Gate
stays Pending; no production deployment.

### V2 minute slices preserve every settings boundary — 2026-09-07

The compact gateway format now carries ordered minute slices inside every time
and event candle. Each slice has actual first/last execution time, OHLC ticks,
volume, and sorted bid/ask/unknown price rows. That is sufficient to classify
RTH, ETH, custom-minute filters and both reset modes even when a 4h/range/
volume/trade/delta/Renko/P&F bar crosses the boundary; no raw execution archive
is sent through Vercel. Aggregate rows remain for fast default-mode painting.

The v2 web validator requires slice time/order/range, per-slice geometry and
volume, whole-candle OHLC, and exact recombination of every side at every tick.
Durable cache namespaces were bumped so a pre-v2 payload cannot be reused.
98 Auction Gap tests, 51 gateway tests, TypeScript and scoped lint pass. The
slice-to-worker adapter, primitive/live receipts and browser QA remain; Pending,
no production push/deployment.

### Browser panes opt into exact history — 2026-09-07

The workspace now adds `auctionGap=1` only for a pane with the Auction Gap
indicator enabled, and includes the resolved contract in the shared request
identity. Replay and live initial hydration use the same path. The browser
rechecks the server-approved DTO against the currently resolved contract and
exact candle timestamps/volumes before copying it into a bounded 32-scope
cache; stale rollover/timeframe responses fail rather than attaching.

97 Auction Gap tests, TypeScript and scoped lint pass (only the workspace's
pre-existing warnings remain). The cache is intentionally not painted yet:
minute-level settings segmentation, worker/primitive consumption, live archive
proof and browser QA still precede the catalogue gate. No deployment.

### Compact rows validated at the web boundary — 2026-09-07

The server-side CME history adapters now request the gateway's opt-in compact
rows and validate them before the public route can preserve or return them.
Validation is tied to the actual decoded candle list and resolved contract: it
requires the v1/Rithmic identity, affirmative coverage and ordering proof,
one exact row set per candle, time or event ownership metadata, on-tick OHLC,
strictly increasing in-range price ticks, nonnegative side/unknown volume and
an exact per-candle volume reconciliation. Any discrepancy produces an explicit
empty unavailable result. Base/gap process and durable caches remain isolated.

95 Auction Gap tests, 50 gateway tests, TypeScript and scoped lint pass. This
does not yet make the indicator available: browser opt-in/state, session-setting
segmentation, worker/primitive consumption, live coverage receipts and browser
QA remain. Gate stays Pending, with no production deployment.

### Time history routes return proven compact rows — 2026-09-07

`auctionGap=1` now attaches the versioned compact row envelope to canonical
minute-and-higher History Plant responses after gateway-side exact-tape volume/
OHLC and coverage reconciliation. Sub-minute 1s/5s/15s/30s history collects the
same rows inside its existing execution fold, avoiding a second disk scan.
Ordinary requests remain byte/behaviour compatible. Both paths reject missing
receipts, truncation, off-tick input and source mismatches with empty rows.

50 combined route/fold/archive/coverage tests and scoped lint pass. Historical
gateway source plumbing now covers time and all event families. Remaining work
is live coverage receipts, settings-time segmentation, web response validation,
worker/primitive Chart wiring and browser QA. Gate stays Pending, no deployment.

### Event history route performs the compact fold once — 2026-09-07

The existing event-history archive scan can now opt into Auction Gap rows via
`auctionGap=1`. It collects exact one-tick rows during the same builder pass,
validates row volume, checks per-bar intervals against raw coverage receipts and
returns a versioned Rithmic row envelope only when all proof passes. Otherwise it
returns an empty explicit reason. Builder retention reports truncation, and the
event cache key separates ordinary and Auction Gap requests so a prior base cache
cannot hide the requested data or leak study payloads into unrelated charts.

31 event/archive tests and scoped lint pass. Time-history route, live coverage,
settings segmentation and browser/Chart consumption remain. Pending gate stays
off; no production push/deployment.

### Raw observation bounds replace trade-only bounds — 2026-09-07

Corrected backfill receipts to use the raw recorder message span rather than
the first/last execution. This can truthfully cover a candle edge before its
first trade and after its last without inventing session boundaries. GAP or
DROPPED markers are counted only inside the backfilled segment; an untimed marker
still fails conservatively, while a marker after the live-tape cutoff belongs to
that later segment. Older rows without `receivedAt` fall back only to real print
times. Two CLI fixture tests and the seven receipt tests pass; scoped lint passes.

Existing receipts require regeneration before they gain these stronger bounds.
Gateway route/live proof/Chart integration remain; still Pending, no deployment.

### Gateway compact event-bar row fold — 2026-09-07

Extended the authoritative event builder to return the one bar that owns each
execution, without changing existing callers. Added a compact Auction Gap fold
for volume, trade, delta, range, Renko and point-and-figure charts. Ownership is
derived while the unchanged builder processes the print, never from synthetic
timestamps; unknown side remains unknown and zero-volume bridge bars receive no
duplicated flow. Output bounding happens only after stable absolute ownership.

49 combined fold/ownership/archive/coverage tests and scoped lint pass across
all six event families. Route, coverage attachment, settings-time segmentation,
live cache and Chart consumption remain. Still Pending, no push/deployment.

### Gateway compact time-bar row fold — 2026-09-07

Added a pure gateway fold from exact ordered prints into sorted one-tick
bid/ask/unknown rows per canonical time candle. It uses half-open candle bounds,
preserves unknown sides, supports genuine zero-volume bridge candles and leaves
caller data immutable. Every nonempty bar must match source volume and exact
OHLC; missing/extra/unassigned/reversed/off-tick/invalid-side data returns no
partial bars. This keeps the full execution tape out of Vercel and the browser.

34 combined archive/coverage/fold tests and scoped lint pass. The fold is not
yet routed, coverage-attached or consumed by Chart; event-bar ownership remains
to add. Auction Gap stays Pending, with no production push/deployment.

### Market-interval coverage proof — 2026-09-07

Added aggregation that proves each actual chart-bar interval from one or more
healthy same-contract coverage receipts. Exact adjacent receipts may join; any
positive hole, damaged receipt, invalid interval or wrong contract fails closed.
Intervals are supplied explicitly, so CME maintenance and weekend closures with
no chart bars are not falsely treated as missing trades.

28 archive/coverage tests and scoped lint pass. The proof is not yet attached
to a gateway-side compact row fold or Chart, so the gate remains Pending and
there is no production push/deployment.

### Coverage evidence reaches the archive loader — 2026-09-07

The existing bounded trade-tape loader now returns the raw per-session coverage
receipts alongside exact prints. It deliberately does not synthesize a global
`coverageComplete` claim: downstream code must validate the receipt contract and
prove the requested market intervals. Missing receipts remain missing evidence,
not empty-market success. Existing event/time chart building is unchanged.

25 archive/coverage tests and scoped lint pass. Multi-session market-window
aggregation, gateway-side compact Auction Gap folding and Chart integration
remain. The catalogue gate stays Pending; no production push or deployment.

### Persistent backfill coverage receipts — 2026-09-07

Added a v1 Rithmic trade-tape coverage receipt and made the existing raw-to-
compact backfill write it atomically beside each contract tape. The receipt
preserves exact contract/session observation bounds, print count, GAP/DROPPED
markers and damaged gzip-member count. Only bounded, correctly ordered evidence
with zero known integrity failures can prove a contained request window; absent,
malformed, damaged, out-of-bounds or cross-contract evidence fails closed.

The backfill still extracts only surviving raw prints and is not promoted into
a repair mechanism. This receipt is source groundwork, not yet aggregated across
sessions or exposed to Chart. 24 archive/coverage tests and scoped lint pass.
Auction Gap remains Pending; no production push or deployment.

### Exact history envelope validation — 2026-09-07

Added a fail-closed validator for the original Rithmic response handed to the
Auction Gap worker. It requires the exact contract, v3/Rithmic source identity,
requested-window coverage, non-truncation, affirmative historical and execution-
ordering completeness, an exact source count, atomic executions, side semantics
v2, valid volume allocation, stable source identities and ordered timestamps.
Any missing or contradictory proof returns no rows and keeps the study unavailable;
the current retained live tape is therefore correctly rejected rather than being
misrepresented as complete history.

90 Auction Gap tests, TypeScript and scoped lint pass. Inspection also confirmed
the raw-recorder backfill preserves GAP/DROPPED and damaged-member counts but does
not repair those holes, so it cannot honestly manufacture completeness. A gateway
archive coverage ledger or licensed exact-print backfill remains required before
Chart wiring and release. Still 28 Pending; no gate, production push or deployment.

### Original response handoff and concrete source limitation — 2026-09-07

Inspected workspace `compactIndicatorExecutionHistory`: beyond its recent window
it keeps up to 12 strongest prints per minute; even the recent portion is capped
at 25,000 records, then combined output at 50,000. Those sparse records cannot
establish historical low-participation tick levels. Existing compaction remains
unchanged for working studies. Institutional normalization also drops flowOnly
and rewrites legacy side semantics, so original response metadata matters.

Added `auctionGapHistorySource` and a narrow publish hook in the existing fetch
after normalization but before persistence merging. It delivers the original
untrusted envelope only to matching explicit symbol/contract listeners. No cache,
network, polling, timer, new stream or retained response body; consumer errors are
isolated from the shared request. Chart consumer and worker envelope validation
remain unwired. The actual source remains NOT proven complete: server order-flow
route publishes retained book trades with truncated=false and historicalAvailable=
false. Request bounds/count/truncated alone cannot be treated as complete-history
proof. Independent source coverage/candle reconciliation is required.

84 tests, TypeScript and scoped lint pass. Tests cover real hook placement,
original metadata, contract isolation, subscriber release and error isolation.
No production source/browser claim or gate change; 28 Pending, no deployment.

### Settings and drawing layer — 2026-09-07

Added normalized settings and the shared-dialog Inputs/Style/Alerts controls:
six include modes, thresholds/sliders, reset and exchange-time detection windows,
touch/cross retest convention, zones/markers/both, placement, extension/width/
opacity/size, four fresh/triggered colours, visibility and alert text/toggles.
Shared numeric bounds are enforced; no new template store or modal. Actual
template export/import preserves every setting. Theme mode uses the existing
visible palette; custom picks use the dialog's existing sibling-seeding/unlink
behaviour. Not enabled: live alert dispatch is still unwired.

Logical-index models preserve event-bar identity, explicit source-window offset,
tick-cell outer edges and stopped/reset endpoints. A dedicated chart primitive
draws zones behind candles and diamond markers above, reprojecting through live
chart scales every draw. Full-opacity default, tick-cell bands and bar-direction
placement (low on rising, high on falling) are project conventions; they have not
been native-screen matched. No animation/DOM viewport polling is introduced.

80 combined tests pass, including six settings/plot tests and the final SSR
component check. Full tsc/scoped lint pass, shared template suite 18/18. Tests
cover configuration safety, real template round-trip, modes/colours, transforms,
detach and real component SSR. These are not browser/visual/source integration
proof. The broader colour-slot verifier fails identically on older 293d23df
release checkout (11 SAR/LR/ST/STD/T3/KST slot expectations); unrelated studies
untouched. Actual Chart source, worker scheduling, attach/update/detach and
alerts/browser/full-depth QA remain. Gates OFF; no deployment.

### Event-bar incremental worker connection — 2026-09-07

Validated allocation now returns the exact unchanged event builder's last-candle
checkpoint. Appending processes only that tail and new executions, recovers global
bar ownership through volume increments and compares every affected candle to
the supplied chart. Duplicate/older prints and mismatched interval/geometry fail
without modifying the checkpoint. Source corrections require reconstruction.

StudySession now connects this allocation to raw/filtered rows, session resets
and incremental lifecycle. It retains last-bar executions and committed identities;
identity retention has an explicit configurable 1,000,000 default limit, returning
execution-capacity-limit rather than silently evicting deduplication evidence.
This is a safety bound, not a proven production history-depth/memory budget.
The worker/client expose event-tail messages. Unlike complete time snapshots,
event deltas cannot overwrite queued deltas: a busy client returns false so the
caller retains/merges prints or requests a complete reseed. Consumer still due.

74 tests, full tsc and scoped lint pass. Incremental ownership and full source-to-
zone output match reconstruction across volume/trade/delta/range/Renko/PF/VB.
The study fixtures explicitly produce nonempty zones, not just equal empty
results. Same-ms bridges, source immutability, duplicate retry, queue safety and
capacity rejection covered. This verifies our builder consistency, NOT protected
DeepCharts numerical/native visual parity. Chart provenance/source integration,
settings/render/template/alerts, browser bundle and real-depth performance remain.
No registration or production deployment.

### Worker history-to-live connection — 2026-09-07

`prepareAuctionGapStudy` exposes the validated raw segments used by both batch
calculation and `AuctionGapStudySession`. The worker now owns a session seeded
from those segments and accepts complete current **time-bar** snapshots. Every
tail still passes contract/coverage, execution, session, volume and actual OHLC
validation. Scope/configuration changes, replay rewind, missed bars and advancing
before finalizing the previous bar return requires-rebuild. Failed new history
invalidates the old seed. A failed tail leaves prior valid lifecycle intact.
This does not invent incremental event ownership: event tails require history
reconstruction until that path is implemented. The worker client exposes the
operation; coalesced updates which skip a close must trigger reconstruction.

68 tests, scoped lint and tsc pass. End-to-end session tests cover forming
correction, finalization, next-bar retest, corrected retest, data failure and
reseed failure. Separate-thread test additionally proves two actual worker
messages retain state; eight worker tests pass after that extension. Browser
bundle, real Chart source and complete per-tick performance remain unverified.
Not registered/released; controls/render/template/alerts and event-live work due.

### Incremental forming-bar lifecycle — 2026-09-07

`AuctionGapLiveLifecycle` shares the historical zone transition and checkpoints
only active zones before the latest chart bar. Replacing the bar means supplying
all of its reset subsegments: restores prior retests/endpoints, removes obsolete
provisional zones and then applies the replacement. No historical price rows
are retained/revisited. All replacement data is validated before mutation;
failed input leaves prior state intact. Older corrections and skipped chart
indices explicitly request reconstruction rather than silently losing retests.
Retained source IDs and zones have a configurable explicit capacity (250,000
each by default); exceeding it reports capacity-limit, never evicts silently.
Snapshots copy visible zones separately from update processing.

Tests compare incremental output with the batch result after each append and
1,000 tail replacements, plus reset subsegments, cross/visibility modes, atomic
errors, capacity, settings/snapshot isolation and historical-row nonaccess.
64 combined tests, lint and tsc passed before a final skipped-bar guard; seven
incremental tests passed after it. This is lifecycle performance structure, not
proof of whole-indicator live latency: execution validation/ownership and worker
state still need connection, followed by Chart controls/render and browser QA.

Current Chart source inspection found only a marketTrades array/version prop,
not an execution coverage envelope. Shared indicator rows are timestamp-sliced;
Footprint is viewport-limited/grouped/filtered. Integration cannot treat these
as authoritative raw ownership/completeness merely because a chart is visible.
The strict study pipeline and explicit provenance remain necessary. Gate OFF.

### Background history execution — 2026-09-07

The whole calculation path now has a lazy module-worker entry and scoped client.
One active calculation and one newest queued snapshot bound pending work. Scope
must include instrument, interval, settings and replay/source epoch. Changing it
terminates the old worker; late replies and wrong revisions cannot publish.
Same-scope completed results may publish before the newest queued result to
avoid starvation. Disposal and callback reentrancy cannot resurrect stale work.
Worker construction, clone and runtime failures produce explicit unavailable
states, without main-thread fallback, provider requests or timer loops.

57 Auction Gap tests pass, including real separate-thread execution of a cloned
three-print fixture through the actual worker entry, queue pressure, stale
replies, callback requests/disposal and failure/retry. Scoped source lint and
full TypeScript pass. Node worker-thread verification is not browser bundling
or live-FPS proof. This schedules history only: incremental live state and actual
Chart source/settings/render/template/alert integration still remain. No gate
enabled and no production deployment from this disconnected foundation.

Reference: https://www.deepcharts.com/helpcenter/article/auction-gap-tracker
Accessed 2026-09-06. This is a consecutive low-participation price-level study,
not an OHLC opening gap or an extreme-only Unfinished Auction alias.

Official images visually inspected:
- https://framerusercontent.com/images/q0XbD8D68PlsFZKqL5oRObslnI.png
  Minimum tick volume 0, opposite threshold 0, Intrabar, 3 consecutive levels.
- https://framerusercontent.com/images/RuWFODzugWSJFZTZvUhY3JkVsrA.png
  Zones, marker at Bar direction, extension 200 bars, width 1, session reset off;
  triggered zones on, trigger-only-touch off; separate fresh/triggered colours.
These are screenshot values, not recovered constructor defaults.

## Installed DLL contract

`python scripts/dotnet-contracts.py ConfigurableWatcher`
matches `VolAnalysis.Monitoring.ConfigurableWatcher` by settings shape; exact
protected catalogue binding/formula is not established. Same 16.0.9 assembly
hash documented in the ordinary tape audit.

- MinTickVol, MaxUnfVol, MinNumConsUnf, ExtendedBars, LineWidth: int32.
- IncludeMode: Intrabar=0, All=1, ExtremeOnly=2, HighOnly=3, LowOnly=4, WickOnly=5.
- PlotMode: Zones=0, Marker=1, MarkerAndZones=2.
- PlotMarkerPrice: BarDirection=0, Low=1, High=2.
- ResetMode: None=0, SessionOpen=1, EthAndRthOpen=2.
- Four fresh/triggered buy/sell colours; EnableTriggeredZone, TriggerOnlyTouch.
- Sound, alert reference, popup, message text.
- FilterTime: None=0, Eth=1, Rth=2, Custom=3; IniSession/EndSession: TimeSpan.
DLL exposes more controls than the prose article; do not limit implementation
to the two include modes described in that article.

## Calculator foundation — NOT registered

`src/lib/auctionGapTracker.ts` detects consecutive qualifying one-tick rows.
All six location modes supported. Same-side exact consecutive ticks required;
opposite-side threshold and total classified tick volume are inclusive.
Wicks exclude the open/close body boundaries. Empty/tied sides have no inferred
direction; any unknown volume breaks the run. These are explicit implementation
conventions awaiting native numerical comparison, not protected-formula claims.

Requires unfiltered volume-at-price, groupTicks=1. Grouped/trade-count/size-
filtered input returns requires-raw-volume. Missing rows break runs rather than
become invented zeros. Rejects corrupt volume, duplicate/out-of-range ticks.
Live candidates are provisional and recalculated; later opposite prints can
remove them. IDs use bar identity (not timestamp alone) for event bars.
No existing indicator changed. Nine calculation tests and scoped ESLint pass;
full repository TypeScript check passed before the final location-mode extension.
The single-file tsc attempt lacked repository aliases, so was superseded by
the successful project-config check; it is not a production build claim.

## Required before release

### Whole-study calculation path

`calculateAuctionGapStudy` joins the validated execution source, explicit
calendar, time/event ownership, independent raw/detection rows and lifecycle.
Failures carry explicit unavailable reasons, not successful empty output. Chart
geometry must match expected candles. For time charts, raw executions must also
reproduce OHLC as well as volume. Synthetic event-chart OHLC is checked against
the unchanged event builder instead. Caller source-coverage provenance remains
required; no records or candles are fetched by the calculation itself.

Four end-to-end tests pass including source-to-retest, partial/mismatched source,
filtered-out retest prints and fabricated-wick rejection; project tsc passes.
48 combined tests passed before the last OHLC test addition. Worker scheduling,
incremental updates, Chart/settings/theme/renderer and real-source/browser QA
still required. No new gate or production deployment.

### Raw row materialization and lifecycle connection

`auctionGapRows.ts` joins exact execution assignments with chart geometry,
produces independent raw/retest and time-filtered detection maps, and splits
reset changes inside one bar into separate segments. Lifecycle now accepts
those separate detection rows and actual chart indices, so reset segments do
not consume fictitious chart bars or self-trigger a source bar's zone.
Empty confirmed bars require explicit source-time/reset provenance, never a
guessed synthetic timestamp. Duplicate/unknown/reversed allocation rejects.

Actual trade ticks remain untouched. Raw price bounds encompass both chart
geometry and actual prints; this is an explicit convention for prints outside
synthetic range boundaries, not native-parity proof. Detector and lifecycle
now accept a minimal structural raw-bar type (existing FootprintBar-compatible),
without requiring unrelated footprint analytics or modifying working studies.
Integration test proves filtered detection plus unfiltered later retest. Full
provider pipeline, worker/incremental UI wiring, controls and visual QA remain.
Final row tests and project TypeScript pass; combined/lint verification recorded
in this continuation. Still no gate registration or deployment.

### Time-chart allocation foundation, 2026-09-07

`auctionGapTimeAllocation.ts` assigns prepared executions using explicit,
nonoverlapping half-open bar intervals and reconciles exact per-bar execution
volume. A boundary print belongs to the next bar, distinct same-ms identities
remain distinct, and session gaps do not absorb prints into adjacent candles.
Missing/extra volume, out-of-window prints and invalid order/IDs are explicit
failures. Empty confirmed zero-volume bars remain empty. Expected intervals and
volumes must come from the same authoritative replay-clipped source window;
this utility cannot prove that caller provenance by itself.

39 combined Auction Gap tests, scoped ESLint and full project TypeScript pass,
including the final stricter event allocation validation. This is still isolated
data-path work. Row materialization, reset subsegments, worker/incremental path,
full renderer/settings and live/browser/release verification remain.

### Exact event ownership foundation, 2026-09-07

`auctionGapEventAllocation.ts` replays the unchanged existing event builder's
forming tail per print, derives owning chart index from volume increments,
and validates all reconstructed candle timestamps/OHLC/volume against the
expected full source seed. Timestamp alone never assigns ownership. One print
maps once; bridge bars receive no duplicated volume. Price comparison tolerance
is tied to tick size, not a price-relative tolerance that could allow whole ticks.
Thresholds include volume, trade-count, delta; range, Renko, PF and VB covered.
Prepared execution records now retain validated tradeCount for those builders.

34 combined tests passed plus scoped lint/full tsc; final stricter numeric
validation reran five allocation tests successfully. Existing event builder
and working indicators unchanged. This is shared-engine consistency, not
proof that the existing engine itself matches DeepCharts' event-bar conventions.

Remaining source gates: expected candles must represent the same full seed,
not a truncated viewport. Existing event builder rejects nonpositive prices;
adapter reports invalid-source rather than lying about support. A range bridge
can attribute a real print outside its synthetic boundary; row aggregation
must preserve the actual price and explicitly reconcile the detector's extreme
semantics, not move the execution to that boundary. Full exact source-to-row
adapter, time-bar allocation, cross-session segments and incremental/worker
integration remain. No Pending gate or production runtime changed.

### Execution source boundary, 2026-09-07

`auctionGapExecutions.ts` validates exact source/expected contract, explicit
coverage, tick alignment, source order, volume consistency and individual-print
OHLC equality. Rejects flowOnly aggregates and conflicting duplicate identities;
identical repeats deduplicate. Replay excludes prints after asOfMs. Explicit
aggressor fills an otherwise unclassified print, but partially classified data
retains unknown volume. Zero/negative tick-aligned futures prices are accepted.
Per-execution session classification retains unfiltered prints with a detection
flag. No new HTTP/stream/login or working-study changes.

29 combined tests, scoped lint and full project TypeScript pass. This strict
boundary still requires integration evidence from real provider payloads; the
coverage assertion is supplied by the caller, not inferred from record count.
Records lack their own contract field, so response provenance must be validated.
No numerical parity, live soak, or complete source adapter is claimed yet.

Current existing `buildFootprintBars` allocates by lowerBoundCandle timestamp
and approximate end; the raw auction path also inherits footprintBuildSettings
including display size filters. Do NOT reuse these as proof of exact allocation
for same-timestamp event bars. Next adapter must assign execution identities/
volumes to actual chart-bar IDs, preserve split-execution conservation and
separate filtered detection from unfiltered retests/reset subsegments.

### Exchange clock foundation

`auctionGapSessionClock.ts` now classifies source executions against an explicit
instrument calendar/timezone. Half-open RTH/custom windows, overnight custom
windows, session-open and ETH+RTH reset keys use local civil dates, not fixed
UTC offsets or timestamp-minus-24-hours across DST. RTH close is not an extra
reset. Equal custom endpoints mean full day (documented convention).
Immutable per-instance calendar/settings and bounded 2048-minute cache; invalid
timestamps return null and invalid configuration throws. No implicit CME calendar
for cash instruments. ETH here means outside configured RTH, not an assertion
that an exchange is open; feed market-calendar gating remains separate.

23 combined tests, scoped lint and full project TypeScript pass. Clock tests
cover both DST transitions, repeated hours, exact window boundaries, overnight
windows, per-execution classification and supplied New York calendar. This
does not establish holiday schedules or native numerical parity. Integration
must preserve unfiltered rows for retests and separately aggregate filtered
detection rows, splitting reset boundaries within event/time bars as needed.

### Lifecycle foundation, subsequent continuation

`auctionGapLifecycle.ts` adds deterministic correction-safe rebuilds: actual
chart-index extensions (same-ms bars remain separate), caller-resolved exchange
reset keys, filtered detection with independent retests, first-retest identity
and fresh/triggered visibility. Retests require an actual nonempty row in the
zone. Internal cross mode additionally requires a close beyond its far edge;
this is an explicit convention, not proven native TriggerOnlyTouch semantics.
No mapping from that native checkbox to the internal controls has been made.

Input must be contract-specific, source-ordered and already replay-clipped.
Duplicate IDs, reversed time, mixed contracts and unavailable intervening raw
data reject the frame instead of showing falsely fresh zones. Caller must
retain prior display with an honest unavailable state; never hide such failure.
These integration responsibilities are not yet wired.

17 detector/lifecycle tests, scoped ESLint and full project TypeScript pass
after the six location modes and lifecycle changes. A single local synthetic
20,000-bar / 1,000,000-row full rebuild took 127.1ms and produced 20,000 zones.
This is NOT suitable for rebuilding on the UI thread per tick. Before release,
use incremental forming-bar updates and off-thread historical reconstruction,
with correction/replay cancellation and bounded retained state. No live-FPS
or market-data/visual/native-parity claim. Gates remain OFF.

- Independent raw one-tick consumer even when Footprint is grouped/filtered;
  correct event-bar allocation, source completeness and replay clipping.
- Retest lifecycle, extension by actual chart bars, session/time filtering,
  trigger-only/trigger visibility, fresh/triggered styling and markers.
- Complete settings, numeric sliders, themes, templates, clean save state.
- Source-timed alert lifecycle, duplicate suppression and closed-market silence.
- Incremental revision/correction handling, bounded buffers, browser/render and
  sustained interaction checks, regression/build and exact production SHA.
- Clarify touch semantics, marker BarDirection placement, time-filter overlap
  and native boundary conventions. Never change Pending just to satisfy count.

### Atomic live handoff and browser continuity receipt, 2026-09-07

The retained execution snapshot previously ran before the gateway registered
the SSE subscriber. A genuine print could therefore arrive after the snapshot
but before registration and be absent from both the seed and the live stream.
Futures and option execution routes now register in a seeding phase first,
queue prints observed during the snapshot, deduplicate them into the seed, and
only then switch synchronously to live delivery.

Every seed now owns a random stream ID and sequence zero; every subsequent
trade event carries the same ID and the next integer sequence. The execution
worker verifies this receipt, discards unproved pending batches across a
reconnect and reconnects on missing, duplicate, reordered or cross-stream
batches. Continuity propagates through the shared worker and workspace event.
Auction Gap supplies `coverage: complete` to its calculation only while that
receipt is continuous; reconnecting or broken streams fail closed and retain
the last proven plot.

This receipt proves the gateway snapshot-to-browser delivery boundary. It
does not prove an upstream Rithmic session had no source disconnect; historical
coverage receipts and exact candle OHLC/volume reconciliation remain separate
source-integrity gates. Two gateway handoff tests, two browser receipt tests,
108 existing Auction Gap tests and full TypeScript compilation pass. The
indicator remains Pending until browser rendering, settings interaction, alert
lifecycle, closed-market behavior and live-market soak are verified.
