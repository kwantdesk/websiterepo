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
