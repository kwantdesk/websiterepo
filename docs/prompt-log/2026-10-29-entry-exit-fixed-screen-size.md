# Entry/Exit drawing arrows: fixed screen size — 29 October 2026

Owner requests manually placed left-toolbar Entry Arrow/Exit Arrow drawings retain their chosen size through chart zoom and scrolling.

## Changes

The old second price/time point defined arrow extents, so horizontal/vertical scale changes changed its dimensions. Its ancestor SVG group also applies an affine viewport scale between React renders, stretching even a fixed-size shape during a gesture.

Persist CSS-pixel half-width/height in drawing style. New tools initialize9x6; legacy tools capture their current first ready projection once and save that size, preserving current visible geometry. The actual resize callback changes pixel extents independently of time/price, preserving anchors and avoiding a height jump when initially grabbing the tip. Saved drawings, templates, normalization and clipboard copies retain the size fields.

Counter-scale only each arrow drawing group around its own projected anchor during the existing same-frame viewport transform. This includes arrow, labels, painted SVG hit targets and resize dot. Other chart drawings retain existing affine behaviour. Cache the fixed-arrow node list at layout commit; do not scan the DOM each frame. Root clip/selection/pointer cleanup remain intact. The automatic real trade fill markers are unchanged.

## Validation

Fixed-size regression checks both directions across independent X/Y zoom and pan matrices:42x18chosen pixels remain42x18; price/time anchor follows the projection. Actual component geometry callback preserves a legacy30x12measurement after3x/0.5xzoom. JSON round-trip/normalization preserves custom sizes; actual transpiled resize callbacks preserve points, initial height and pointer listener cleanup for both tools. Existing entry/exit13checks and position-colours7checks pass. Updated the old arrow test's obsolete bounding-box assumption to the current painted SVG hit contract, retaining interior hits without widening grabs.

Scoped ESLint and complete1536MiB-capped production build/TypeScript pass. Two additional older scripts (test-draw-layer-anchoring, test-drawing-selection) fail stale source-pattern assertions. Isolated VM execution against unmodified HEAD proves identical failures predating this task; no unrelated anchoring or selection implementation was changed to satisfy those patterns.

Production through existing main-only Vercel integration. No VPS, provider, recording, account or order changes. Independent liquidity-depth integrity remains unresolved as recorded separately.
