# Super Trend pair — implementation audit

Status: calculation prerequisite only. Both catalogue entries remain Pending.

## Live plot integration continuation

Both enabled studies now use the incremental hook even with alerts off.
`paintSuperTrendSeries` shares the batch colour/style mapping with one-point
live paints. Slope colour compares with the preceding candle, not the previous
tick. Series keys include instance IDs; the prior static keys would collide
when more than one copy was added.

Chart coalesces live paints with requestAnimationFrame after the candle's own
paint, using its event-bar time map rather than inventing coordinates. Native
overlay series update directly; own-series labels receive merged live data.
Difference sends a local event consumed only within ChartIndicatorPanes,
which merges the scoped tail and recomputes pane geometry/domain. Main chart,
footprint and profile calculations are not called by that event.

`SuperTrendPlotBuffer` caps stored tail points at 1500, replaces by chart time,
keeps completed history authoritative and rejects mismatching style/config
keys. History reseed clears the relevant pending paints/buffers. Replay removes
the pane channel immediately, and chart cleanup cancels pending frames.
Three additional tests cover bounded tails, historical correction ownership,
style changes, instance keys and same-bar colour parity with the full engine.
22 Super Trend tests and scoped lint pass. Browser/performance inspection is
still required: this is structural/test evidence, not measured live FPS.

Next release work: official screenshots; actual browser settings/labels,
horizontal/vertical pane behavior, audio permission behavior and Save/reload/
templates; full build and single scoped push with exact live SHA verification.
Both gates are still off (30 Pending), and local changes are not deployed.

## Live calculator and alert integration

The batch and live calculators now share one `advance` recurrence. The live
calculator checkpoints only the numerical state before the forming bar:
replacement restores that checkpoint, append commits the previous state.
Three tests compare every replacement/append against full recalculation,
including warmup, malformed-current-bar repair, late input and history reseed.
It retains no candle history and performs constant work per live update.

All four existing workspace candle publishers now include optional
`sourceTimestampMs`. Execution batches use actual record times; price batches
reuse the already validated uncached `newestSourceTimestamp`; index snapshots
use `chartSourceTimestamp(snapshot.timestamp)`. No endpoint, interval or
subscription changed. An AST test checks every actual publisher and rejects
dispatch-clock fallback.

`useSuperTrendAlerts` now seeds from the same lite candles as the engine,
consumes existing candle events and dispatches only eligible fresh reversals.
History reconciliation seeds silently; duplicate masks survive same-bar seeds.
Replay/closed-market conditions are supplied from Chart. A compiled real-hook
test verifies notification/dispatch, incorrect chart keys, repeated/stale events
and unmount cleanup. One per-chart themed status toast is now rendered.

Inspection found no consumer of the generic indicator-alert event. The new
hook therefore implements its own optional browser oscillator and popup; merely
emitting that event was not sufficient. Audio is lazy, closed on unmount and
checks freshness again after resume. Browser autoplay/audibility remains to be
verified; failures show a sound-unavailable notice rather than claiming success.
No existing indicator-alert behaviour changed.

19 Super Trend tests, scoped lint and TypeScript pass. Gates remain disabled.
Remaining: inspect reference screenshots, browser all settings/labels/sound/
save/template behaviour; ensure live plot cadence uses the new calculation
path rather than leaving visuals on slower React history refresh; orientation
parity; full production build/performance check and scoped push/live SHA check.

## Label rendering continuation

`SuperTrendLabels` is now attached to the overlay's own line series and updated
on series reuse/theme changes. It draws separate name/value labels and their
independent backgrounds at the latest visible point, using that point's trend
colour. Marker background switches between chart background and trend colour.
Native price-axis value badges are disabled for this study so the custom
value-background setting controls the actual displayed label. Three real
primitive tests cover visibility, colour, backgrounds, precision and detachment.
14 combined Super Trend tests, scoped lint and TypeScript pass.

Auto-centre opt-out now resets its override when re-enabled, only for this new
study. Existing studies retain their previous options branch. Exact vendor
marker semantics/geometry still need screenshot/browser comparison; this is
not a pixel-parity claim.

Alert source investigation: `LiveChartCandleDetail` currently contains only
key/candle, not provider observation time. `LIVE_CHART_EXECUTION_EVENT` has real
record times but is dispatched only when footprint/instant tape is active, so
depending on it would silently disable alerts on a plain price chart. The
workspace's four candle publishers have source records, tick.timestamp or
snapshot.timestamp available. Next integration must explicitly carry verified
source time (never Date.now fallback), and reconcile the forming candle without
introducing a full-history calculator pass on every tick. No feed edits yet.

## Integration in progress

The real engine now routes both IDs to `superTrendSeries.ts`; gates remain off.
Flat defaults/numeric sliders, dedicated style/name controls and two colour slots
are connected. Engine tests prove overlay versus histogram placement, exact
price-minus-line pairing, independent theme/custom colour ownership, scalar
roundtrip, width/styles and per-instance secondary-scale options.

The shared pane renderer now accepts an optional explicit histogram thickness:
only the new Difference output supplies it. Both horizontal and vertical paths
use `indicatorHistogramWidth`; legacy studies retain candle-body thickness.
This fixes an integration mismatch found during inspection: setting lineWidth
alone did not change histogram bars.

`SuperTrendAlertTracker` has bounded per-instance state and tests for baseline,
repeat direction, stale/disconnected/replay/closed-market input and scope reset.
It is NOT dispatched from Chart yet. The caller must supply real trade receipt
time, live eligibility and a scope that changes on backfill/settings/instrument;
render time cannot act as feed evidence. The 15-second freshness bound is an
explicit KwantDesk safety convention, not a vendor timing claim.

19 combined new math/engine/alert/width, KST renderer and catalogue tests pass.
Settings UI is wired but not browser-verified. Defaults for name/background/
marker controls are still awaiting rendering, and alerts await actual wiring.
Do not enable either Pending gate until these are complete; no no-op controls
may be released. Chart orientation/labels and alert source mapping are next.

## Reference evidence

- [DeepCharts Super Trend](https://www.deepcharts.com/helpcenter/article/super-trend):
  ATR length 10, multiplier 3, bullish/bearish colours, line style/width (1),
  short name, labels/backgrounds, auto-centre and secondary-axis controls.
  Trend changes support sound, alert name and message notifications.
- [DeepCharts Super Trend Difference](https://www.deepcharts.com/helpcenter/article/super-trend-difference):
  price minus trend in a separate horizontal or vertical histogram, same
  length/multiplier, positive/negative colours, width 4 and short name.
- [TradingView calculation reference](https://www.tradingview.com/support/solutions/43000634738-supertrend/):
  HL2 bands offset by ATR, constrained by previous bands and previous close;
  strict close crossings change direction. This supplies a public calculation
  convention, not proof of DeepCharts' protected seed implementation.

Read-only metadata inspected in the licensed installed
`C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll` using
`scripts/dotnet-metadata.py`:

- Description getters `get_SuperTrend` 0x10878 and
  `get_SuperTrend_Difference` 0x10880 exist.
- `Deepchart.Validation.IsolatedFieldChecker` exposes Length (0x2c06c),
  Multiplier (0x2c07c), EnableAlertSound (0x2c08c), AlertName (0x2c09c),
  EnableMessagePopup (0x2c0ac). Its constructor is 0x2c1a0.
- `VolAnalysis.Collections.PredicateDictionary` exposes Length (0x2c210),
  Multiplier (0x2c220); constructor 0x2c310.
- These matching shapes are evidence for settings, not independently proven
  class-to-study bindings. Constructor IL queries returned no usable bodies.
  No protected code, factory seed or exact pixel-parity claim.

## Implemented calculation

`src/lib/superTrend.ts` uses a full-window mean seed and Wilder ATR recurrence;
first true range is high minus low. The first ready output is bearish.
Direction is retained explicitly, including zero-width bands. Touches do not
reverse. Outputs contain trend, close-minus-trend, ATR, direction, reversal
and a hard-break marker after malformed data. Negative/zero prices are valid.
All OHLC must be finite and within high/low. Invalid or non-increasing bars
reset warmup, preserve timestamp high-watermark, and never fabricate values.

The forming candle is recalculated from its source prefix; no accumulating
per-render state, clock polling, volume substitution, feed request or login.
O(n) time, O(1) working state besides returned points. Maximum length 1000
fits the existing 1500-bar lite input; recursive ATR/bands still depend on
seed history, so exact cross-platform history parity needs equal input spans.

Six tests pass: hand-calculated bands and reversals, strict touches/zero and
negative prices, prefix/live replacement, malformed/reset behavior, bounds,
and an independent array recurrence across four lengths/four multipliers.
26 combined Super Trend/KST/T3/SAR tests pass; scoped ESLint passes.

## Remaining release checklist

- [x] Shared calculator and independent deterministic tests.
- [x] Inspect official general/subgraph screenshots for visible control choices (alert screenshot and behavioural parity still outstanding).
- [ ] Persisted bounded settings, sliders and individual theme/custom colours.
- [ ] Wire price overlay and independently scaled difference histogram.
- [ ] Labels/backgrounds/auto-centre and actual supported orientation choices.
- [ ] Functional sound/message alerts with historical-load suppression,
  per-instance identity, stale-source guard and repeat-event deduplication.
  Existing event channel: `kwantdesk:chart-indicator-alert`. Do not add no-op
  toggles or replay historical signals on mount/theme/settings changes.
- [ ] Browser settings/geometry/Save/reload and template roundtrip.
- [ ] Actual engine/history/data-path integration, performance checks and build.
- [ ] Enable only after release tests; scoped main push and exact live SHA check.

## Reference screenshot and local browser continuation

Visually inspected the official Super Trend general/subgraph and Difference
subgraph images. Difference also exposes name/value labels, independent label
backgrounds, chart-colour marker and auto-centre controls. Added these to the
Difference defaults, actual engine and both pane orientations. Its vertical
line renderer now retains per-point colours/dashes using the existing tested
segmented plot renderer. No working indicator's rendering is changed.

Reference images: `HpNZWlg40C6mTl6I0bLeXAKnfE.png`,
`FFdNny707FBsnKL4Gayb0gnR2I.png`, `g7orDof7S6w1G2jKZlLfU9gxc.png`
on `https://framerusercontent.com/images/`. Observed UI states are not proof of
protected constructor defaults. In particular Super Trend's reference shows
AutoColor None; our natural direction colouring remains an explicitly
unresolved naming/behaviour comparison. Difference's style selection is blank
in the image; the article describes histogram, not proof of the selected text.

The isolated browser fixture uses synthetic candles, the real engine, settings
dialog, Lightweight Charts and label primitive / real pane component. Super
Trend name `Trend QA` and name/value/background selections survived reload.
Both studies saved and immediately closed without a second unsaved prompt.
Difference's name/value/value-background selections also survived reload.
This verifies fixture-local persistence, not authenticated account sync or
template import/export. The Difference pane was below the screenshot viewport;
its label geometry is covered by component tests but still needs visual QA.

Full TypeScript check found the new `findLast` unsupported by this repository's
target library; replaced it with a backwards scan without copying the array.
25 Super Trend tests now pass, including actual rendered pane-label markup,
offscreen/invalid suppression and engine control propagation. Full TypeScript
and scoped ESLint pass. No production build/release this continuation. The
two gates remain off; 30 entries are still Pending. Remaining checks include
orientation geometry, template roundtrip, live plotting performance and audio.

## Live state integrity continuation

Found and corrected a live-state issue before release: invalid/stale source
timestamps were excluded from painting only after advancing recursive state.
They are now rejected before the calculator. The actual hook test injects
missing/null/NaN/stale/future source times paired with a future chart timestamp,
then verifies that the next legitimate point still matches independent clean
calculator state. No new provider subscriptions or network requests.

Added actual pane-hook execution with controlled React lifecycle and animation
frames: 1,000 events queue one frame, wrong chart/instance events are ignored,
an unrelated working CVD group retains identity, reset restores history, and
chart switch/replay cancels pending work and drops old live buffers. This is a
deterministic scheduling test, not a measured production FPS claim. 26 tests
pass; scoped ESLint and full TypeScript pass.

Re-read the official Super Trend article: its Auto Color None retains both
trend colours. UI now calls the existing natural-direction mode "None (trend
colours)" and calls the optional one-colour mode "Single colour", preserving
stored keys without presenting different behaviour under the same label.
Article image link 4 resolves to a 2400x2 separator, not an alert screenshot;
no additional visual alert-default evidence was recovered.

`npm run build` completed successfully (compile, TypeScript, 80 static pages,
optimization). This is the current shared dirty worktree build, not proof of
the isolated Git release tree; unrelated desktop/social edits remain excluded
from this task's commits. No deployment was triggered.

## Dockable Super Trend continuation

Added a bounded `chartArea` choice for Super Trend: main price chart (default)
or separate pane. Separate panes use the existing horizontal/vertical docking
workflow rather than pretending to share arbitrary numbered DeepCharts panes.
Both orientations preserve trend colours, points/line styles and label settings;
live pane updates now accept both studies. The overlay secondary-axis preference
is retained but its irrelevant checkbox is hidden while in a separate pane.
Moving back to the main chart restores that preference. Price-level Super Trend
does not inherit Difference's zero-centred domain or histogram behaviour.

Browser-tested the actual selector, Save/close and reloaded pane selection.
Viewed the real horizontal and right-docked vertical renderer with synthetic
data. Horizontal latest labels overlapped recenter controls; added 28px label
clearance, keeping selection of the actual latest visible point unchanged.
Vertical output shows both trend colours and independent name/value labels.
The fixture's dock buttons drive the real pane layout prop; this is not proof
of the drag gesture. Its minimize callback is deliberately a fixture no-op,
so no collapse verification is claimed. No native app or live feed used.

29 tests pass, including both live-pane identities, pane/overlay transitions,
price units, settings JSON roundtrip and control-clearance markup. Full
TypeScript passed the placement changes; scoped lint passes. Final complete
build needs rerun after the latest label-clearance addition. Template file and
authenticated storage checks, live visual/audio verification and release are
still open. Both Pending gates remain closed.

## Template, audio and browser-live verification

Saved `QA Super Trend full settings` through the actual shared template UI,
reloaded, and found it in Saved templates. Export produced the real 741-byte
`C:/Users/Karen/Downloads/super-trend-qa-super-trend-full-settings.kwantdesk.json`;
read its contents and confirmed the format/version/study, pane choice, numeric
settings, colours and label flags. No actual native file-picker import or
authenticated second-device sync is claimed. The real template library now
has explicit roundtrips for both Super Trend studies, wrong-study rejection,
re-storage and preference-sync event checks: 18/18 template checks pass.

Four actual-hook audio tests pass with a controlled AudioContext: history is
silent, fresh reversal schedules the tone and disconnects ended nodes,
unmount/stale delayed resume suppress tones, and rejected resume produces an
unavailable notice. This proves API lifecycle, not speaker audibility or
browser-specific autoplay permission.

Extended the labelled synthetic browser fixture with the actual live hook,
incremental painter, Lightweight Chart updates and pane event listener. Manual
ticks changed ST from 102.2846 to 101.8246, with the green live label visually
painted. Difference tick produced 11.8100, expanded the axis and painted its
green histogram/label. No timer, provider request or fake production data.
The fixture callback is a local adapter, not a full production Chart mount.

Next known release issue: `seriesDomain` excludes a lone Super Trend plot when
Include On Auto Center is false and falls back to -1..1 (or zero padding for
Difference). Separate panes should retain a useful prior manual/auto domain,
not disappear upon toggling this control. Fix this in the pending pair only;
do not change existing working indicator scaling. Also finish warmup status,
final combined build and scoped release-tree verification before enabling.

## Auto-scale repair and local registration candidate

Repaired separate-pane auto-centre-off with a Super Trend-only retained domain.
It keeps the preceding useful domain, bootstraps saved-off settings from actual
finite values, clears on chart/replay scope or removed instance, and supports
explicit recenter without touching existing working study scaling. Both pane
orientations share the baseline. Tests execute the real pane-domain function.
Warmup panes now explicitly report ATR warming up instead of disappearing.

37 focused tests and scoped lint pass. Full production build passes on the
shared worktree (TypeScript plus 80 pages). Browser actual setting toggle kept
99..104, and saved-off reload/right docking retained that range. Calculation
microbenchmark: 100,000 same-bar updates, maximum length 1000, 1500-bar seed,
16.22ms on this machine; not a browser FPS or live-market soak claim.

Both catalogue/renderer gates are now registered LOCALLY. Inventory confirms
128 total / 100 registered / 28 Pending, zero orphan gates. No push yet:
isolated release-tree build and exact production SHA verification remain.
Reference caveats above remain explicit, including protected seeds and marker
semantics; these are documented implementation conventions, not DLL parity.

## Isolated release verification / deep-history correction

Detached release tree created at
`C:/Users/Karen/AppData/Local/Temp/kwantdesk-supertrend-release-27b6c4e5`.
Its 89 combined indicator/registration tests pass. Turbopack initially rejected
the external node_modules junction; webpack compiled but its different generated
route checks rejected the pre-existing `buildTpoLevelsPayload` export. That
unrelated working route was not changed. Replaced only the temporary dependency
junction with a physical local copy; robocopy exit 1 means files copied. Prior
webpack output was preserved outside the release tree, not mixed into its types.
The final isolated check will use the same Turbopack method as production.

Final history-path review found the pair still used the 1500-bar lite history.
Moved both to the existing 20,000-bar route and use the identical deep history
to seed live calculation. Updated bounded live merge to retain the loaded base
history rather than truncate it to 1500 on the first tick. Live-tail storage
remains capped at 1500; output is capped at the larger existing base length.
New 20k-history/forming-tick/routing regression passes: 38 focused tests now.
Measured full 20k calculation p95 4.245ms across 30 warmed local samples.
Rebuild isolated release tree at the updated commit before one main push.

Final isolated result at `293d23df`: normal Turbopack production build passed,
including TypeScript and all 80 pages. 90 combined indicator/registration tests
and 18 template checks passed in that same committed release tree. The earlier
temporary dependency-link/webpack failures above are resolved for the actual
production build path; no TPO route or unrelated files were changed. One main
push follows; exact deployment verification remains a distinct release check.

Production release passed: GitHub reports deployment completed for
`websiterepo-yfmi`, deployment `FAzNsNGjgXbWMaceh4Ts5e84WjHo`. Live diagnostics
returned `18a17c4d5ba23233ae678c4a75e324f596f0927b`, matching the main push.
Both studies are live; remaining catalogue count is 28. No extra deploy command
or duplicate project was used. Documentation follow-up will ship with the next
implementation batch rather than cause a documentation-only build.

No available indicator modified. No production release for this prerequisite.
