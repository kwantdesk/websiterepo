# Drawing timeframe integrity — 2026-10-24

## Request

Long/short position drawings expand or move after changing 1m to 3m. Preserve
time/price placement and magnification for all drawings, not only calculators.

## Diagnosis and repair

- Chart's timeToX/xToTime mixed current React timeframe/candles with the native
  series still on screen during asynchronous hydration. A reproduced pending
  3m selection projected a future anchor at1142px instead of1230px. The reverse
  path also rounded fractional anchor positions to whole native candles.
- ChartDrawLayer applied one affine transform across destructive timeline
  replacement. Reaggregation changes compressed gaps/indices non-affinely;
  applying old basis measurements could magnify the entire SVG, including text.
- New chartDrawingCoordinates reads only the actual numeric native timeline.
  Interpolates between adjacent native indices; edge extrapolation uses up to12
  native neighbor gaps/median, with no candle-history scan or pending timeframe.
  Future event-time extrapolation remains a display convention, not invented data.
- Both native candle setData paths advance a projection revision before changing
  the timeline. The shared drawing layer rejects old-basis compensation, hides
  only obsolete geometry, and coalesces one React reproject. Its layout commit
  reveals fresh geometry and realigns before paint. Ordinary native pan/zoom
  retains synchronous compensation; no per-tick React drawing reconciliation.
- Saved timestamps/prices/styles are unchanged. No migration, workspace reset,
  provider request/cadence, VPS restart, trade or account mutation.

## Verification

- Old HEAD Chart/ChartDrawLayer executed through the new runtime tests:
  pending-timeframe projection and stale-timeline transform both fail (2 failures).
  Receipt: tmp/drawing-timeframe-baseline.log.
- New timeframe tests8/8; adjacent chart drawing suite19/19. Tests execute actual
  Chart coordinate functions and actual layer viewport callback; long/short
  geometry across1/3/5/15m, catalogue anchor persistence/roundtrips, fractional
  positions, session gaps, irregular times, future edges, degeneracy and pan/zoom.
  Catalogue anchor checks are not full per-tool pixel/render acceptance.
- Position resize9, migration7, grab10, colours7, default size5, primitive6 pass;
  position behaviour script passes. State drawing8/horizontal extension3 pass.
- Scoped ESLint0errors. Full production build/typecheck succeeds,84static pages.
  No whole-Chart ESLint run (previous runs exhausted heap).
- Old test-draw-layer-anchoring script still expects readProjection at commit
  and another rAF, both retired before this task. Its first assertion already
  disagrees with unchanged HEAD. Do not claim this old source-shape suite passes.
- No signed-in production timeframe UI or market-open soak performed. No owner
  trading tab refreshed. Standing recording gaps, history rebuild, provider
  parity/cadence, backup/restore and capacity/live-soak gates remain open.

## Release

One scoped main-only Git release; production verification recorded after build.
Preserve all unrelated native/social/gateway/documentation work in the dirty tree.
