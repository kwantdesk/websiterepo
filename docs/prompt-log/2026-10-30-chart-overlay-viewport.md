# Chart overlays must leave the viewport with their anchors

Owner request: off-screen chart overlays are sticking to the upper border, and the same problem needs fixing on the left and right. Screenshots show stacked session/IB labels and profile text along pane edges.

## Cause and change

- The embedded `SessionHighLowRenderer` forced every price label into the pane using minimum/maximum Y coordinates. Its collision fallback also clamped labels onto the upper/lower borders. It now culls off-screen price/time anchors, uses natural label coordinates and accepts only collision placements inside the plot. Known bounded end anchors outside the pane no longer borrow the visible right border. Unbounded forward levels retain their deliberate right terminus. A plot clip respects the left drawing-toolbar inset.
- Native volume-profile caption placement previously clamped every text box into view, shrank box measurements without shrinking text, scanned the entire pane for placement and still emitted a box when no space remained. It now retains an index-aligned nullable result, omits off-screen/oversized/crowded labels, and limits collision adjustments to two nearby rows. Price-level captions no longer clamp their Y coordinates.
- Fixed-range volume-profile drawing geometry no longer clamps its time bounds onto the left/right borders. The body keeps the actual projected coordinates and clips normally. Explicit profile snap modes remain supported.
- Removed equivalent label clamping from selected position-calculator readouts, classic GEX levels, dark-pool GEX tags, SMT divergence endpoints, ZigZag retracement labels, higher-timeframe summaries, hedge labels, expected-move rails and chart-zone captions. Calculator readouts require a visible anchor; the calculator geometry uses an explicit pane clip.

No provider, gateway, candle, indicator calculation, execution, account or protection state changes. No live feed restart.

## Validation

- Actual embedded session/IB renderer is extracted from `Chart.tsx` with the TypeScript AST and executed against deterministic chart/canvas fixtures; no separate copy of its layout logic is tested. Cases cover all four edges, forward levels, bounded/future endpoints, exact pan distances, restoration and crowded edge rows.
- Actual native profile renderer checks fixed-range horizontal translation. Label-placement tests cover all edges, index preservation, no shrinking and crowded captions. Actual calculator renderer checks off-screen readouts and their restored positions.
- Seven focused regression tests pass. Broader profile/style/SMT/HTF/dark-pool selection: eight existing source-contract failures were reproduced against unmodified HEAD in an isolated temporary fixture. These are stale assertions about profile layer/source wiring, active profile updating, dark-pool initial enrichment and the prior chart-width renderer; this task does not rewrite unrelated indicator contracts.
- Scoped primitive lint and the full production build pass. Verify the main-only production deployment and its actual release SHA before reporting the change live.

Browser acceptance limitation: no signed-in active Charts browser surface is exposed to the tools. Deterministic actual-renderer tests and the production release SHA establish implementation/release evidence; do not claim an observed screenshot comparison on the owner's live chart.
