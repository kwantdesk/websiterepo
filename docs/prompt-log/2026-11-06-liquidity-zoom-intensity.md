# Liquidity heatmap zoom intensity repair

## Request
Fix the broad saturated liquidity bands shown when zooming out. Preserve colours and the actual order data; deploy without restarting the feed or inspecting the owner's browser.

## Reproduced cause
RollingDepthEngine sums multiple price levels into each raster row when zooming out, but AdaptiveContrast retained the old single-level calibration. The same immutable synthetic 160-level book produced 20 grouped rows all at intensity 252/255 after changing rowTicks from 1 to 8. This proves a rendering defect; it does not establish the quality of the live provider book or prove every issue visible in the screenshot.

## Change
Track the rowTicks used for contrast calibration. Recalibrate only when that price grouping changes, using the actual grouped quantities. Ordinary live appends, pans and sensitivity changes retain the fixed scale and incremental raster reuse. Reset clears the grouping identity. Palette definitions, smoothing, book aggregation, trades, subscriptions, and user settings are untouched. Cache-bust the static module import chain.

The existing unrelated uncommitted cumulative-depth direction/mode repair and its untracked test are preserved but excluded from this release. The isolated release checkout tests the exact HEAD baseline plus this task's changes, not those unrelated edits.

## Evidence and validation
Actual engine before/after synthetic probe: 20/20 rows near maximum before; 0/20 after, with six distinct intensities (0,73,118,204,233,246). No synthetic input is used in the product.
Four behavioural regressions cover zoom-out saturation, zoom-in restoration, live/pan/sensitivity reuse, and instrument reset. Together with presentation, price zoom and performance suites: 20/20 pass in both the working tree and isolated release source. All three changed JS modules pass node --check. Full production build and production deployment verification recorded in local tmp/liquidity-zoom-build.log and tmp/liquidity-zoom-production-release.json.

No owner browser inspection, feed restart, account/order changes, paid data calls or recording changes. Live visual appearance on the owner's existing tab is not independently certified.
