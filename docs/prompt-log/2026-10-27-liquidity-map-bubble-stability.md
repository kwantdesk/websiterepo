# Liquidity Map executed-bubble stability — 2026-10-27

Request: printed bubbles were appearing and disappearing.

Verified causes:
- The owner's live saved Display setting enabled Differential bubbles: opposing executions cancel, including to zero. Turned that setting off through the live UI and verified the checkbox unchecked. New/default/reset views now show gross executed volume. Explicitly enabled differential mode remains available with an explanatory tooltip.
- Screen-distance clustering previously merged executions across arbitrary historical times when zoomed out. Both clustering stages now use fixed 250 ms source-execution windows, including catch-up packets containing several windows. Density and smart-cluster reference volumes are local to each window, preserving historical membership when unrelated later activity arrives.
- Incremental cache refresh could cut into a net-zero window absent from cache and resurrect just its remaining sell/buy half without a new execution. Refresh now includes whole source-time windows.

Validation: regressions failed before the fix for gross cancellation, old-dot consumption and zero-net refresh resurrection; now pass. Targeted feed, CVD continuity, freeze recovery, bubble anchors, performance and motion regressions pass. Public JavaScript syntax checks and production build are recorded in tmp/liq-bubble-stability-*.log.

Scope: presentation only; no VPS restart, additional provider polling or owner trades. Genuine rolling-history eviction and user-selected volume filters still apply; optional differential mode can cancel inside its short active window. This does not invent missing execution history.
