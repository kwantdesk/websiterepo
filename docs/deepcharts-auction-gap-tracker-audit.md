# Auction Gap Tracker — implementation in progress

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
