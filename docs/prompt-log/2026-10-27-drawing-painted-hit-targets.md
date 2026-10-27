# Drawing grab areas — 2026-10-27

Request: drawings must only grab on their visible marks or visible handles. Empty trend-line bounds and Fibonacci gaps must pan the chart.

## Diagnosis and change

- SVG overlay placed a transparent rectangle across every multi-anchor drawing. Removed it. Dedicated hit targets now mirror the actual SVG strokes and actual label bounds; actual filled risk/reward boxes, arrowheads and profile bars can also select. Decorative fills and empty shape interiors do not grab. Body targets remain present but non-intercepting in eraser/placement mode so JS hit queries and erasing still work.
- Precision tools used bounding boxes and generic anchor connectors. Their real canvas painter now supplies the geometry, including enabled Fib levels, translated channel rails, actual freehand paths, executed profile rows and calculated AVWAP curves. Only selected, visibly rendered handles resize; hit slop is two CSS pixels and handle radius six CSS pixels.
- Professional tools had a broad per-tool hit fallback OR the generic geometry rectangle. Both manager and primitive now query their actual pane painters, including custom Bezier curves, partial arcs, rotated/rounded shapes, rendered level styles and text alignment. Hidden drawings/anchors do not grab. The exposed geometry helper also respects stroke outlines, rotation, arc spans, ray extensions and bounded labels.
- No market data, provider configuration, accounts, journal records, order fills or VPS services changed.

## Verification

- 244 focused Node tests pass across drawing selection, existing clipboard/context menus, extensions, timeframe integrity and precision configuration. Separate existing handle test: 10/10 checks pass. TypeScript, scoped ESLint and production build verified before release (release status below).
- Inventory coverage: 62 SVG + 17 Precision + 106 Professional = 185 registered drawing implementations, enumerated below. Every SVG painter produces dedicated stroke/label targets. Every canvas painter returns finite geometry and its actual visible mark is selectable; old broad testHit is deliberately forced true in Professional tests and cannot capture empty/out-of-plot space.
- Browser: actual ChartDrawLayer mounted with synthetic local candles; all 62 SVG tools passed 522-point consistency checks between native SVG geometry and the JS hit-query path (32364 points). This is a path-consistency check, not independent market-data or screenshot parity evidence.
- Actual browser pointer drags: trend-line empty anchor-box space: chart pan presses 1, drawing updates 0; direct line stroke: updates 8. Fibonacci gap: chart pan presses 1, drawing updates 0; direct level: updates 8. Pointer-transparent eraser target query PASS. No owner workspace/trade/account was edited for these tests.
- Automated per-tool renderer coverage is broader than manual UI coverage: manual pointer drags cover the two reported tools; other tools are covered by their actual paint geometry and registry tests, not a claim of manually dragging every possible setting combination.

## Per-tool inventory

### SVG sidebar (62)

- [x] brush: actual paint target/geometry coverage
- [x] highlighter: actual paint target/geometry coverage
- [x] trendLine: actual paint target/geometry coverage
- [x] ray: actual paint target/geometry coverage
- [x] extendedLine: actual paint target/geometry coverage
- [x] trendAngle: actual paint target/geometry coverage
- [x] infoLine: actual paint target/geometry coverage
- [x] horizontalLine: actual paint target/geometry coverage
- [x] horizontalRay: actual paint target/geometry coverage
- [x] verticalLine: actual paint target/geometry coverage
- [x] crossLine: actual paint target/geometry coverage
- [x] parallelChannel: actual paint target/geometry coverage
- [x] flatChannel: actual paint target/geometry coverage
- [x] regressionTrend: actual paint target/geometry coverage
- [x] gannFan: actual paint target/geometry coverage
- [x] gannBox: actual paint target/geometry coverage
- [x] pitchfork: actual paint target/geometry coverage
- [x] schiffPitchfork: actual paint target/geometry coverage
- [x] modifiedSchiffPitchfork: actual paint target/geometry coverage
- [x] insidePitchfork: actual paint target/geometry coverage
- [x] fibRetracement: actual paint target/geometry coverage
- [x] fibExtension: actual paint target/geometry coverage
- [x] fibChannel: actual paint target/geometry coverage
- [x] fibTimeZone: actual paint target/geometry coverage
- [x] fibCircles: actual paint target/geometry coverage
- [x] fibSpeedFan: actual paint target/geometry coverage
- [x] xabcd: actual paint target/geometry coverage
- [x] abcd: actual paint target/geometry coverage
- [x] trianglePattern: actual paint target/geometry coverage
- [x] headShoulders: actual paint target/geometry coverage
- [x] threeDrivers: actual paint target/geometry coverage
- [x] cypher: actual paint target/geometry coverage
- [x] elliottImpulse: actual paint target/geometry coverage
- [x] elliottCorrection: actual paint target/geometry coverage
- [x] entryArrow: actual paint target/geometry coverage
- [x] exitArrow: actual paint target/geometry coverage
- [x] longPosition: actual paint target/geometry coverage
- [x] shortPosition: actual paint target/geometry coverage
- [x] forecast: actual paint target/geometry coverage
- [x] priceRange: actual paint target/geometry coverage
- [x] dateRange: actual paint target/geometry coverage
- [x] datePriceRange: actual paint target/geometry coverage
- [x] barsPattern: actual paint target/geometry coverage
- [x] fixedRangeVolumeProfile: actual paint target/geometry coverage
- [x] anchoredVolumeProfile: actual paint target/geometry coverage
- [x] anchoredVwap: actual paint target/geometry coverage
- [x] rectangle: actual paint target/geometry coverage
- [x] rotatedRectangle: actual paint target/geometry coverage
- [x] ellipse: actual paint target/geometry coverage
- [x] circle: actual paint target/geometry coverage
- [x] triangleShape: actual paint target/geometry coverage
- [x] polyline: actual paint target/geometry coverage
- [x] path: actual paint target/geometry coverage
- [x] text: actual paint target/geometry coverage
- [x] note: actual paint target/geometry coverage
- [x] callout: actual paint target/geometry coverage
- [x] priceLabel: actual paint target/geometry coverage
- [x] signpost: actual paint target/geometry coverage
- [x] arrowMarker: actual paint target/geometry coverage
- [x] flagMark: actual paint target/geometry coverage
- [x] measure: actual paint target/geometry coverage
- [x] emoji: actual paint target/geometry coverage

### Precision canvas (17)

- [x] precision-line: actual paint target/geometry coverage
- [x] precision-ray: actual paint target/geometry coverage
- [x] precision-horizontal-line: actual paint target/geometry coverage
- [x] precision-vertical-line: actual paint target/geometry coverage
- [x] precision-parallel-line: actual paint target/geometry coverage
- [x] precision-rectangle: actual paint target/geometry coverage
- [x] precision-ellipse: actual paint target/geometry coverage
- [x] precision-text: actual paint target/geometry coverage
- [x] precision-pencil: actual paint target/geometry coverage
- [x] precision-fibonacci-retracement: actual paint target/geometry coverage
- [x] precision-fibonacci-projection: actual paint target/geometry coverage
- [x] precision-fibonacci-fan: actual paint target/geometry coverage
- [x] precision-ruler: actual paint target/geometry coverage
- [x] precision-volume-profile: actual paint target/geometry coverage
- [x] precision-anchored-vwap: actual paint target/geometry coverage
- [x] precision-buy-calculator: actual paint target/geometry coverage
- [x] precision-sell-calculator: actual paint target/geometry coverage

### Professional canvas (106)

- [x] price-channel: actual paint target/geometry coverage
- [x] highlight-x: actual paint target/geometry coverage
- [x] highlight-y: actual paint target/geometry coverage
- [x] ruler: actual paint target/geometry coverage
- [x] measure: actual paint target/geometry coverage
- [x] fib-fan: actual paint target/geometry coverage
- [x] elliott-impulse: actual paint target/geometry coverage
- [x] elliott-correction: actual paint target/geometry coverage
- [x] elliott-triangle: actual paint target/geometry coverage
- [x] elliott-double-combo: actual paint target/geometry coverage
- [x] elliott-triple-combo: actual paint target/geometry coverage
- [x] xabcd-pattern: actual paint target/geometry coverage
- [x] cypher-pattern: actual paint target/geometry coverage
- [x] head-and-shoulders: actual paint target/geometry coverage
- [x] abcd-pattern: actual paint target/geometry coverage
- [x] triangle-pattern: actual paint target/geometry coverage
- [x] three-drives-pattern: actual paint target/geometry coverage
- [x] cyclic-lines: actual paint target/geometry coverage
- [x] time-cycles: actual paint target/geometry coverage
- [x] sine-line: actual paint target/geometry coverage
- [x] ghost-feed: actual paint target/geometry coverage
- [x] image-content: actual paint target/geometry coverage
- [x] post-content: actual paint target/geometry coverage
- [x] idea-content: actual paint target/geometry coverage
- [x] label: actual paint target/geometry coverage
- [x] right-price-label: actual paint target/geometry coverage
- [x] left-price-label: actual paint target/geometry coverage
- [x] dot: actual paint target/geometry coverage
- [x] diamond: actual paint target/geometry coverage
- [x] square: actual paint target/geometry coverage
- [x] up-arrow: actual paint target/geometry coverage
- [x] down-arrow: actual paint target/geometry coverage
- [x] anchored-vwap: actual paint target/geometry coverage
- [x] dynamic-poc: actual paint target/geometry coverage
- [x] cvd-correlation: actual paint target/geometry coverage
- [x] market-profile: actual paint target/geometry coverage
- [x] fixed-market-profile: actual paint target/geometry coverage
- [x] anchored-market-profile: actual paint target/geometry coverage
- [x] zigzag-tpo-profile: actual paint target/geometry coverage
- [x] trend-line: actual paint target/geometry coverage
- [x] horizontal-line: actual paint target/geometry coverage
- [x] vertical-line: actual paint target/geometry coverage
- [x] ray: actual paint target/geometry coverage
- [x] arrow: actual paint target/geometry coverage
- [x] extended-line: actual paint target/geometry coverage
- [x] cross-line: actual paint target/geometry coverage
- [x] info-line: actual paint target/geometry coverage
- [x] trend-angle: actual paint target/geometry coverage
- [x] horizontal-ray: actual paint target/geometry coverage
- [x] rectangle: actual paint target/geometry coverage
- [x] circle: actual paint target/geometry coverage
- [x] triangle: actual paint target/geometry coverage
- [x] price-range: actual paint target/geometry coverage
- [x] parallel-channel: actual paint target/geometry coverage
- [x] regression-trend: actual paint target/geometry coverage
- [x] flat-top-bottom: actual paint target/geometry coverage
- [x] disjoint-channel: actual paint target/geometry coverage
- [x] fib-retracement: actual paint target/geometry coverage
- [x] fib-extension: actual paint target/geometry coverage
- [x] fib-channel: actual paint target/geometry coverage
- [x] fib-time-zone: actual paint target/geometry coverage
- [x] fib-speed-fan: actual paint target/geometry coverage
- [x] fib-time-extension: actual paint target/geometry coverage
- [x] fib-circles: actual paint target/geometry coverage
- [x] fib-spiral: actual paint target/geometry coverage
- [x] fib-arcs: actual paint target/geometry coverage
- [x] fib-wedge: actual paint target/geometry coverage
- [x] pitchfan: actual paint target/geometry coverage
- [x] andrews-pitchfork: actual paint target/geometry coverage
- [x] schiff-pitchfork: actual paint target/geometry coverage
- [x] modified-schiff-pitchfork: actual paint target/geometry coverage
- [x] inside-pitchfork: actual paint target/geometry coverage
- [x] gann-box: actual paint target/geometry coverage
- [x] gann-fan: actual paint target/geometry coverage
- [x] gann-square-fixed: actual paint target/geometry coverage
- [x] gann-square: actual paint target/geometry coverage
- [x] long-position: actual paint target/geometry coverage
- [x] short-position: actual paint target/geometry coverage
- [x] date-range: actual paint target/geometry coverage
- [x] date-price-range: actual paint target/geometry coverage
- [x] projection: actual paint target/geometry coverage
- [x] text-annotation: actual paint target/geometry coverage
- [x] callout: actual paint target/geometry coverage
- [x] brush: actual paint target/geometry coverage
- [x] highlighter: actual paint target/geometry coverage
- [x] arrow-marker: actual paint target/geometry coverage
- [x] arrow-mark-up: actual paint target/geometry coverage
- [x] arrow-mark-down: actual paint target/geometry coverage
- [x] ellipse: actual paint target/geometry coverage
- [x] arc: actual paint target/geometry coverage
- [x] rotated-rectangle: actual paint target/geometry coverage
- [x] path: actual paint target/geometry coverage
- [x] polyline: actual paint target/geometry coverage
- [x] curve: actual paint target/geometry coverage
- [x] double-curve: actual paint target/geometry coverage
- [x] anchored-text: actual paint target/geometry coverage
- [x] note: actual paint target/geometry coverage
- [x] price-note: actual paint target/geometry coverage
- [x] price-label: actual paint target/geometry coverage
- [x] flag-mark: actual paint target/geometry coverage
- [x] pin: actual paint target/geometry coverage
- [x] comment: actual paint target/geometry coverage
- [x] signpost: actual paint target/geometry coverage
- [x] table: actual paint target/geometry coverage
- [x] forecast: actual paint target/geometry coverage
- [x] bars-pattern: actual paint target/geometry coverage

## Release

Release path: one scoped main push through the existing websiterepo-yfmi Git integration. Completion requires READY at the exact pushed SHA and public diagnostics confirming that SHA with gateway HTTP 200; the verified result is reported in the task response. No manual or preview deployment.
