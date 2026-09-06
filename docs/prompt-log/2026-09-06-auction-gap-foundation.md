# Pending-library continuation — Auction Gap Tracker

Prompt: engineer the remaining studies with correct reference logic/settings,
data, themes, save/templates and responsive rendering; preserve working studies.

Implemented: isolated raw-tick gap detector, all six DLL location modes,
thresholds, exact consecutive levels, provisional live candidates and explicit
invalid/unavailable data states. Read official screenshots and DLL enums.

Outcome: nine tests and scoped lint pass. No registration, production push or
working-indicator change. Full integration/lifecycle/UI/verification remains;
28 Pending. Notes and code will ship with the next verified release batch.

Continuation: added chart-bar extension/reset/retest lifecycle and historical
correction rebuilds. 17 tests, scoped lint and full TypeScript pass. One 20k-bar
synthetic rebuild took 127.1ms: worker/history and incremental live integration
are required, not a per-tick full UI rebuild. Still not enabled or deployed.

Exchange-time continuation: explicit calendar clock with per-execution filtering,
overnight windows, DST-safe reset dates and bounded cache. 23 combined tests,
lint and TypeScript pass. Clock is not yet connected to source aggregation;
no runtime deployment or gate change. Native boundary parity remains unproved.

2026-09-07 source continuation: strict provider-execution validation and replay
cutoff, exact identity/tick/volume checks and per-print session flags. 29 tests,
lint and full TypeScript pass. Found existing timestamp allocation/display-filter
inheritance unsuitable as proof for this new study. Exact allocation/source
integration still required. No production change; 28 Pending.

Event allocation continuation: recovered exact per-print owning bar through
unchanged event engine tail replay with full expected candle reconciliation.
34 tests pass; no bridge-volume duplication or same-ms timestamp guessing.
No production push/enablement; exact row generation and UI/live integration
remain, with explicit synthetic-boundary and nonpositive-price limitations.
