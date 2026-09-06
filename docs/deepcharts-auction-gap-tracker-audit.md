# Auction Gap Tracker — implementation in progress

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
