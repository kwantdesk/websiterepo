# Liquidity bubble coordinate repair

## Request and findings
The owner reported bubbles apparently detached from the market path. The screenshot alone cannot establish the original execution timestamps or prove that each pictured print was wrong.

Confirmed two renderer defects:
- An execution newer than the final depth frame was clamped to that earlier frame. It could move horizontally when the real timeline caught up.
- Mixed buy/sell spheres were painted 1–2 pixels below their market coordinate; single-side spheres were centred correctly.

The renderer now defers only out-of-timeline prints until an actual frame brackets their source time, retaining them in the cluster cache. Every sphere composition uses exactly the same source-price centre. No price snapping, fabricated quotes, changed palettes, changed clustering or feed restart.

## Verification
30 focused tests pass, including actual renderer method execution for all nine sphere compositions, delayed/newer prints, zoom/pan, rolling history, cluster stability and smart-volume behavior. Renderer syntax check passes.

A read-only NQ gateway sample returned matching quote/depth bid/ask but executions at their own prices, sometimes outside the latest spread. This is evidence that current quotes and earlier prints differ, not proof that the screenshot was caused entirely by these two fixes. Existing quote trails are sampled bid/ask, not an execution-price curve; valid prints are not moved onto those lines.

The pre-existing dirty depth-engine cumulative/contrast patch was excluded from this release. No provider subscription reset, service restart, account/order change or owner-tab refresh.
