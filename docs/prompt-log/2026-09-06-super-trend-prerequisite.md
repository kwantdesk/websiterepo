# Pending indicator library — Super Trend prerequisite

Prompt: engineer remaining Pending studies using DeepCharts references and
licensed DLL evidence, not just remove the Pending labels.

Work: audited Super Trend and Difference docs and matching DLL setting shapes;
implemented their shared ATR/trailing-band/difference calculator with explicit
seed and invalid-data rules. Added six math tests; 26 combined tests and
scoped lint pass. Detailed limitations and next integration steps are in
`docs/deepcharts-super-trend-audit.md`.

Outcome: prerequisite only, not Add/live. 30 Pending remain. Rendering,
settings, alerts, persistence and production verification are still required.
No feed/infrastructure spending, working study changes or new deployment.

Continuation: connected engine series, scalar settings, dedicated style/name UI
and colour slots. Added tested bounded alert tracker (dispatch not yet wired).
Found that histogram width ignored lineWidth; added opt-in width handling to
both pane orientations without changing existing candle-width behavior.
19 combined tests pass. Both gates remain off until labels/alerts/browser and
release verification are complete. This remains local, not deployed.

Label continuation: implemented actual own-series labels/backgrounds, visible
point anchoring, theme updates and auto-centre re-enable reset. Three primitive
tests plus math/integration total 14 passing; scoped lint and TypeScript pass.
Found candle events lack provider timestamp and execution events depend on
other indicators. Recorded the correct source publishers for safe alert wiring.
Still 30 Pending; not released until remaining live/UI verification is done.

Live continuation: shared O(1) forming-bar calculator equals batch output in
tests. Existing candle events now carry provider time without new feed calls.
Hook dispatch, themed popup and optional audio wired; no existing generic alert
listener existed, so event emission alone was insufficient. 19 tests pass,
including actual hook execution and all four source-publisher checks. Scoped
lint/TypeScript pass. Browser audio/visuals and live plot cadence still unproved;
both Pending gates stay off and this remains local until the release gate.

Plot continuation: wired frame-coalesced native overlay and pane-local histogram
updates using the incremental calculation; fixed per-instance series-key
collisions and same-bar slope colour; bounded tail/history/style/replay guards.
22 tests and scoped lint pass. Browser/performance/build verification remains;
still 30 Pending, not deployed or falsely claimed complete.

Reference/browser continuation: inspected three official screenshots and found
missing Difference label/background/auto-centre controls; wired these into
settings, engine and both pane orientations. Corrected an ES target compatibility
error in label lookup. Added three actual component/engine tests: 25 pass,
full TypeScript and scoped lint pass. Both real dialogs save and close without
re-prompt; local fixture settings survive reload. Account template roundtrip,
full visual/orientation/live/audio checks remain. No gates enabled, no push;
30 Pending remains the honest count.

Live verification continuation: fixed stale/invalid provider frames modifying
recursive state before paint suppression. Actual-hook regression verifies
fresh output remains correct after maliciously future chart timestamps with
invalid source times. New pane lifecycle test covers 1,000-to-one frame
coalescing, chart isolation, reset/replay cleanup and unchanged working groups.
26 tests, full TypeScript and scoped lint pass. Corrected Auto colour wording
against the official article without changing stored settings. Production
build started; release gates remain off pending remaining verification.

Build outcome: full `npm run build` passed, including TypeScript and 80 static
pages. Shared dirty-worktree build only; unrelated changes not staged. No
deployment triggered. Remaining 30-entry scope unchanged.

Placement continuation: Super Trend now switches to a real dockable pane,
retaining price units, colours, line/point styles, labels and live updates.
Browser verified selector/save/reload plus horizontal/right-side renders.
Fixed a visible label/recenter overlap. 29 tests pass; placement TypeScript and
scoped lint pass. No gates enabled or production push; template/live/audio and
post-edit full-build checks remain. 30 Pending remains the actual tally.

Template/audio/live continuation: actual UI saved and reloaded a named Super
Trend template; export produced a real 741-byte JSON file whose contents were
read. Both studies pass real template-library roundtrips (18 template checks).
Four controlled actual-hook audio lifecycle tests pass. Browser synthetic live
ticks visibly update ST and Difference, including labels and histogram scale.
Found remaining auto-centre-off domain fallback issue in separate panes; this
needs scoped correction before release. No production changes, still 30 Pending.

Scale/release-candidate continuation: fixed auto-centre-off with a retained,
scope-safe Super Trend-only domain and explicit recenter. Added warmup pane
status. 37 focused tests, full shared-worktree build, and browser off/save/
reload/vertical-scale checks pass. Both gates now registered locally; inventory
is 100 registered / 28 Pending. Isolated release-tree build and one scoped
main push with exact live SHA verification still due. No deployment yet.

Isolated check: 89 combined tests passed. External-link Turbopack restriction
and webpack's pre-existing TPO route validation prevented that build route;
no unrelated route changed. Physical local dependency copy completed. Final
review fixed 1500-bar truncation: both studies now use 20k deep history and the
live merge retains it. 38 focused tests pass. Updated isolated Turbopack build
and exact deployment verification still outstanding; local tally 28 Pending.
