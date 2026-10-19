# Volume-profile mode / appearance combinations — 2026-10-19

Owner reported that choosing Line while using Delta and total volume removed
the delta profile, and requested checking related combinations across profiles.

## Root cause and change

`nativeVolumeProfilePrimitive` built one total-volume silhouette for Line and
then skipped all interior paths. Delta, delta-percent and bid/ask therefore
either disappeared or were replaced by a misleading volume-shaped contour.

Every selected component now collects the same row bounds as Solid and paints
an open stepped contour in its configured component colour (or shared gradient).
Missing rows, sign changes and empty price spans break contours, avoiding false
bridges. No per-frame sorting or extra non-Line row arrays. Zero delta no longer
creates a minimum-width docked mark. VAH/VAL/POC attachment uses selected-mode
geometry independently of appearance. Data calculations/fetches are unchanged.

Shared Chart ownership/wiring inspected for Daily, Weekly, Composite, Monthly,
Session, Visible Range and Ask/Bid/Delta variants. Independent TPO Line does not
have this multi-component gate. Draw-on SVG and SingleProfileWorkspace do not
expose this same visualStyle path; Swing/Values currently force Solid. Do not
claim600 browser UI combinations were clicked: this is a real-renderer fixture.

## Verification

-21 focused Node tests pass: new six-test matrix plus continuity, fine width,
  ownership and profile variants suites. Matrix exercises600 renderer cases:
  four model geometries × five modes × five styles × three docks × two axes.
-225 saved mode/style combinations across nine configurable profile IDs retain
  independent settings. Line edges match corresponding Solid row bounds; zero
  delta, showDelta=false, gradients, gap splitting and level attachments tested.
-Chain, chain-fallback and no-back-overhang scripts all pass.
-Scoped ESLint and full84-page production build pass. Initial build caught
  TypeScript nullability in the contour helper; explicit guard fixed before
  release and focused tests rerun successfully.
-Counting-canvas benchmark: seven large profiles, steady pan0.76ms/frame,
  auto-scaling0.62ms, cold live update2.59ms. Synthetic CPU measurements, not
  browser FPS/soak proof and not a production latency guarantee.
-Same benchmark with combined Delta/Volume Line: steady0.85ms, auto-scaling
  0.75ms, cold update2.60ms. Ran via an in-memory script variant, no fixture
  source or production settings changed to obtain the measurement.
-Hidden local browser inspected Solid versus Line for all five modes using
  actual renderer commands projected to SVG. Both combined components and
  signed/bid-ask edges visible; temporary tab/server closed afterward.
-Wider edge-anchoring suite: four pass, one pre-existing source-pattern failure
  (`widthBasis: "chart"` expected in unchanged Chart.tsx). Not edited to pass.

## Still open

Signed-in live profile acceptance/soak; historical execution coverage; weekly
aggregate completeness; stable public streaming (temporary QuickTunnel lacks
SSE support); footprint UI/soak. No gateway restart, provider connection,
infrastructure purchase or new polling was introduced by this renderer task.

Deployment verification will be appended after the normal scoped main push.
