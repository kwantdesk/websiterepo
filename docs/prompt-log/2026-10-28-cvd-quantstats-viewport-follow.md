# CVD / QuantStats following pan and zoom

Owner reports lower CVD and QuantStats no longer follow candle scrolling and zoom.

## Cause

Chart's native candle viewport changes immediately. Its React viewportVersion intentionally waits for an 80ms trailing settle timer, inside a transition, to avoid reconciling the huge Chart tree during a gesture. ChartIndicatorPanes depended on that parent revision and had no native viewport subscription. A continuous gesture could therefore indefinitely delay its SVG coordinate refresh, affecting CVD and QuantStats together. This is separate from classification/history/live-delta calculation.

## Change

- Chart supplies a native visible-logical-range subscription; chartReadyRevision rebinds it after initial creation/recreation.
- Only ChartIndicatorPanes increments a local revision, coalescing notifications to one requestAnimationFrame callback. Both horizontal and side-docked surfaces consume that revision.
- Existing time-coordinate mapping, drawing-rail offset, data values, CVD continuity, pane scaling controls and full-Chart settle policy remain intact.
- Empty/removed panes unsubscribe; cleanup cancels pending frame work. No polling, new provider requests, feed restart, account/preference changes or Footprint grouping changes.

## Verification

- Three new tests execute the actual Chart subscription callback and transpiled pane component, with hook/frame scheduling, real sampling/coordinate helpers and SVG inspection. Repeated pan/zoom updates align CVD wick centers and QuantStats text-cell centers to native chart coordinates while the incoming parent viewportVersion stays unchanged. Also verifies listener/frame cleanup and chart-recreation rebinding.
- The same three tests fail against the original 3966b676 pane renderer (no pane-local subscription), then pass with this change. Reproduce using KWANT_PANE_VIEWPORT_BASELINE=1.
- 19 targeted tests pass: viewport-follow, pane docking, CVD render continuity, CVD live-tail hydration and Super Trend pane scale. Three CVD session-sampling tests and five chart-interaction-budget checks also pass (27 total).
- Full production build passes, including TypeScript, with 1536MiB heap and BelowNormal priority.
- Scoped ESLint passes for ChartIndicatorPanes.tsx and indicatorPaneViewport.ts. Including the pre-existing 23k-line Chart.tsx in the initial lint process exhausted its 4GiB heap; no clean full-Chart lint claim. Changed callback is typechecked and executed in the regression harness.

## Limits / still-open work

This reproduces/fixes the source viewport subscription fault; signed-in physical browser acceptance/FPS during a busy trading session has not been measured. It does not claim to repair missing historical executions or all CVD feed faults. Deferred backend performance activation remains deferred until owner is not trading. Original Footprint first-open transient remains unresolved after the owner-requested rollback. Existing provider parity, archive completeness, off-box backups and browser-owned unattended demo execution dependencies remain open.

Release status will be appended after main-only Git deployment verification. Do not create a documentation-only follow-up deployment.
