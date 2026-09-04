# Drawing-tool horizontal extension

## User request

When a rectangle is drawn, double-clicking it must offer controls to extend it flush to the right edge, the left edge, or both. Apply the same behavior to any other drawing tools where horizontal extension is meaningful.

## Diagnosis

- The bundled vendor rectangle contained edge-extension fields, but KwantDesk charts use the separate custom `ChartDrawLayer`; the live drawing settings, persisted drawing style and renderer never read those fields.
- Consequently the earlier implementation could not affect rectangles drawn from the chart's left toolbar.
- Painting alone would still leave the extended section impossible to select or double-click, because both pointer hit paths used the original anchor bounds.

## Fix

- Added a persisted horizontal-extension setting with `None`, `Left`, `Right` and `Both` choices to the real drawing model and double-click settings dialog.
- Applied it to Rectangle and Fibonacci Retracement, the two current tools whose bounded horizontal geometry can be extended without changing the meaning of their anchors. Ray and Extended Line retain their purpose-built behavior; measurement tools remain bounded so their reported time/range stays truthful.
- Extended geometry to the chart plot edge and kept it clipped behind the price scale.
- Updated both direct hit-testing and the SVG interaction layer, so any visible extended section can be selected, moved or double-clicked.
- Kept old saved drawings unextended by default, while new choices persist through drawing saves and style templates.

## Verification

- `npm run test:drawing-horizontal-extension` — 3/3 passed, covering every direction, overscan, backward compatibility, persistence, supported-tool scope and renderer/settings wiring.
- Scoped ESLint on the three implementation files and regression test — passed.
- `npm run test:draw-layer-anchoring` — 7/7 passed.
- `npm run build` — production compilation, TypeScript validation and all 80 static pages passed.

## Outcome

Double-clicking a Rectangle or Fibonacci Retracement now exposes a clear Extend control. The drawing reaches the requested plot edge exactly, never paints over the price scale, stays interactive across the extended area, and remembers the choice.
