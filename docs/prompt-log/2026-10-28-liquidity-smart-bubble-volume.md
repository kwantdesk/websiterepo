# Liquidity Map smart clustering and executed-volume sizing — 2026-10-28

Request: maximum clustering still leaves too many bubbles; bubble size should reflect actual trades; the first minimum-trade increment appeared to remove every bubble.

Source evidence: authenticated VPS snapshot read only, no gateway restart.2,500 captured NQ executions:2,396 size1 and104 size>=2, maximum20. Existing engine on that captured batch/fixed geometry: minimum1 produced914 bubbles/2,693 contracts; minimum2 produced57/297contracts, matching the qualifying raw contracts exactly. Thus the claimed all-disappear effect was not reproduced in the raw threshold path; do not silently turn single executions into invented larger orders or apply a cluster threshold as an individual-trade threshold.

Confirmed faults: clustering was permanently partitioned into250ms source windows even at maximum; its tangent spatial parameter jumped10.8→2,756 between99 and100. Bubble sizes were normalized against the largest visible/rebuilt group and capped to the same maximum diameter, changing visual size between viewport/incremental rebuilds and concealing differences among large clusters.

Changes: smooth bounded spatial strength0..16; nested source windows250/500/1000/2000/4000ms as gross clustering increases. Earliest actual trade anchor and exact buy/sell/gross totals retained. Differential mode deliberately retains its250ms cancellation boundary so later opposite trades do not erase already-settled net bubbles. Incremental renderer boundary expansion receives the actual clustering window. Sphere sizing uses a fixed100-contract reference (sphere volume proportional to contracts, flat-dot area proportional when requested), no viewport renormalization or identical-large-dot cap. Fractional diameters retained and edge culling follows the actual radius.

Minimum individual trade and minimum combined bubble volume remain separate, literal inclusive contract thresholds. Added exact numeric entry, synchronized with existing sliders/outputs, and clear labels/tooltips; no preference reset. Changed module graph/iframe entry revisions updated to20261028-smart-volume-bubbles.

Measured captured batch at maximum:206 bubbles instead of914 with exactly2,693 contracts retained; minimum2 retained44 bubbles/297contracts. This is fixed-fixture geometry, not a claim about every live viewport. A separate50,000-print synthetic burst retained all475,000contracts and clustered in~103ms/default-strength and~80ms/maximum on this laptop (one sample, not a sustained frame-rate guarantee).

Verification:15 executable core tests pass: stronger clustering, bounded parameters/nested windows, exact thresholds, fixed volume sizing, full/incremental diameter parity, settled anchors and net-cancellation stability, actual numeric/slider handlers. Broader controls/performance tests31pass/7fail; each of those7source-assertion failures also occurs against HEAD baseline (baseline additionally has an unrelated right-rail assertion failure fixed in the dirty workspace). JS syntax checks pass. Scoped lint/build/release results below. No provider credentials, recording, trade/order/account changes or gateway restart.

Full1536MiB-capped BelowNormal production build and TypeScript passed; scoped default ESLint clean. JS syntax checks pass. Release pending.
