# Chart indicator audit

Full source inventory and initial calculation pass completed on 4 November 2026. Full interactive verification remains open.

Read FINDINGS.md first. CHECKLIST.md lists every catalogue indicator and its default settings in the requested order.

- findings.json — confirmed defects, changes and open engineering work.
- controls.json — 124 indicators and 4,302 default setting entries with source references.
- dialog-controls.json — 376 explicit UI control nodes and source locations.
- calculation-mutations.json — common-fixture calculation output checks, including inconclusive mutations.
- candidates.json and candidate-dispositions.json — literal-reference candidates and dynamic-source explanations.
- test-results.json and test-failures.json — 237 initial commands, exit codes and initial failure excerpts.
- Local .log files retain complete output for individual commands.

## Current status

- Nine confirmed defect groups have code changes. This includes a shared delivery path for previously undelivered alert events.
- Big Blocks alert production, Bounce Levels chart markers and DOM Pro legacy controls remain open.
- 182 initial commands passed and 55 failed. Failed source assertions and runner errors require classification.
- No indicator is marked fully verified until Add, each settings tab/control, save/reload and intended chart behavior have been exercised.
- A control changing JSON or having a source reference never counts as full verification.

## Repeatable inventory

Run each command from the repository root.

    node --import ./scripts/alias-hook.mjs scripts/audit-all-indicator-controls.mjs
    node --import ./scripts/alias-hook.mjs scripts/audit-indicator-dialog-controls.mjs
    node --import ./scripts/alias-hook.mjs scripts/audit-indicator-calculation-controls.mjs

The common calculation fixture supplies OHLC and classified volume. Depth, options snapshots and execution-backed primitives require their dedicated fixtures and live data checks.
