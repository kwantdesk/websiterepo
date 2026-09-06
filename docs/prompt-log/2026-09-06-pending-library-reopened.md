# Pending indicators still unavailable

Prompt: “so many of the indicators are still pending ... go through and
engineer each one ... use deepcharts dll etc to sort this out”.

Finding: the old completed 21-item audit was not a complete inventory. There
were 128 catalogue entries, 38 failing the actual engine/renderer release
intersection. Two had implemented engines under different canonical IDs.

Batch 1 fix: repair Big Contracts and Liquidity Sweep catalogue IDs; migrate
persisted aliases and favourites without modifying existing detector math.
Add an executable full inventory and regression against orphan engine/renderer
IDs. Retain the other 36 Pending gates until they are individually completed.

Verification: registration/migration tests 3/3; existing Deep Contracts/Effort
and Liquidity Stop Sweep detector scripts passed. Scoped catalogue/audit/test
ESLint passed. Production build passed with TypeScript and 80 static pages.
No authenticated on-chart visual or live-market soak is claimed.

Favorites regression passed; template suite 16/16 passed. The older library
toggle source test still expects the pre-compatibility `live ? Add : Pending`
JSX shape; it fails against the existing instrument-aware button expression,
which this patch does not change. This is not recorded as a passing suite.

Reference: installed Deepchart DLL metadata reader succeeded (2,777 types,
30,928 methods); Speed type search found no unobfuscated match. Read official
Absolute Levels settings and existing Big/Deep Contracts evidence. Protected
formula bodies have not been recovered and parity is not claimed from names.

Outcome: partial progress, not whole-library completion. The controlling
checklist is `docs/pending-indicator-library-2026-09-06.md`; the ongoing goal
remains active for the other 36. No feed, provider or paid infrastructure change.

Batch 2: implemented Absolute Levels from the official manual-price contract
and eight public DLL settings. Exact prices, independently styled/theme-aware
full-width lines, no autoscale distortion, settings opened on Add. Five new
tests plus three registration regressions passed; build passed. Isolated
browser QA verified line rendering, price edit, immediate clean save, clean
close and fixture-local reload. No authenticated cloud/live-market or exact
DeepCharts stock-default/pixel parity claimed. See the Absolute Levels audit.
35 unfinished rows remain; ongoing goal is not complete.
