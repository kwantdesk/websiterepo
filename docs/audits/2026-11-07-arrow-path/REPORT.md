# Arrow Path — 7 November 2026

Requested: multi-click price forecast arrow underneath Trend Line, finished by choosing Cursor.

Implemented in the shared chart drawing layer and catalogue using the existing persisted `path` drawing type. Moved its menu entry directly below Trend Line, labelled Arrow Path. Every click stores a time/price vertex; Cursor commits only clicked vertices (a single point is discarded). Double-click also finishes without a duplicate endpoint. A fixed 10px arrowhead follows the final distinct segment. Existing shared drawing settings, selection, handles, clipboard, undo and workspace storage remain in use.

Verified using the actual ChartDrawLayer component in an isolated local browser fixture: four alternating vertices persisted exactly once on Cursor; arrowhead points in final segment direction; single vertex discarded; double-click saves three distinct vertices. Screenshot `arrow-path-verified.png` is a component fixture, not live market data. Scoped ESLint and real toolbar SSR passed.

Existing source-pattern tests test-draw-layer-anchoring and test-drawing-selection fail identically on unchanged HEAD (stale expectations). Theme test also fails on an untouched Chart.tsx source-pattern expectation. These unrelated checks were not altered to manufacture passes. Production webpack build and live release verification recorded below when finished.

Final isolated production webpack build passed including TypeScript and page generation; scoped lint passed. Build log: tmp/arrow-path-release-build-final.log.
