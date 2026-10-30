# Stronger, source-time smart clustering — 2026-10-30

The owner asked for better Liquidity Map smart clustering. The existing proximity calculation used weighted depth-frame indexes. Extra quote updates therefore changed distances between the same executions. The second merge stage also ran at zero strength, and merged cluster keys could change when sequence IDs passed a numeric/lexicographic boundary such as 9 to 10.

Clustering proximity now uses volume-weighted execution time in fixed 50-ms reference units. It retains the renderer's frozen reference geometry, so scrolling, zooming and quote-only update frequency do not change membership. The strength curve remains smooth and bounded, with increased useful reach. Nested source-time windows now extend to 8 seconds at maximum (2 seconds at the existing default setting 52), while differential cancellation retains its 250-ms source windows.

Both merge stages enforce a complete cluster price envelope, reaching at most eight instrument ticks at maximum strength. A large trade cannot swallow unrelated price levels merely because its bubble radius is large. The merge threshold now shares sphere sizing's fixed 100-contract reference, so an unrelated large print cannot shrink the threshold and split existing clusters. Zero strength bypasses both proximity stages. Growing groups retain the first execution's identity, actual time and price; volume-weighted calculation coordinates do not become display anchors. Bubble sizing, buy/sell totals and individual minimum-trade filtering retain their existing contracts. Settled source windows stay independent of future windows, and the incremental rebuild uses the selected full source window.

Verification:

- 41 focused clustering, anchor, canvas, chrome and trading checks pass. Added coverage for sparse/dense quote cadence, numeric-ID identity stability, unrelated price separation, volume-threshold stability and zero-strength behavior. Updated the maximum-strength settled-window fixture to fall beyond the new 8-second boundary.
- Scoped ESLint and full production build pass.
- Local Node fixture, 28,800 unique executions / 84,000 contracts over 60 seconds at three nearby prices: default-strength bubbles **60 → 30**; maximum **15 → 8**; volume identical. Five-run full-history medians: default old 23.17 ms/new 23.31 ms, maximum old 18.89 ms/new 19.52 ms. Maximum-strength incremental rebuild median **1.34 ms**, maximum **1.72 ms** across 20 updates. These are synthetic local measurements, not a certification of every live market workload or upstream feed completeness.

Frontend asset revisions cover the engine and its importers. No gateway change, settings reset, account mutation or infrastructure purchase. Reload an already-open map to replace its in-memory modules; the existing saved slider value now uses the improved mapping.
