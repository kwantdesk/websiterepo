# Right price-scale double-click toggle

The chart engine's native double-click resets price auto-fit to true every time. It has no second-click unlock. The normal Chart now installs a lifecycle-scoped right-price-axis toggle. First double-click enables the existing auto-fit/centring; the second disables auto-fit while retaining the displayed range, restoring manual movement. Repeated cycles work.

The engine recognises double clicks during mousedown, before the DOM dblclick event. Its price-only double-click reset is disabled while this handler is installed, so it cannot re-enable auto-fit after the unlock. Time-axis reset settings are preserved. The handler measures the actual rendered chart element (not a possibly wider parent), excludes the plot and bottom axis/corner, and removes itself/restores copied native reset options on cleanup. A manual viewport operation that already releases auto-fit is respected.

## Verification

`node scripts/audits/price-scale-toggle-browser.cjs` uses the actual chart engine: three consecutive lock/unlock cycles, plot/corner exclusion, real manual vertical dragging after unlock, cleanup/native reset restoration, zero browser errors. `PRICE_AXIS_BASELINE=1` reproduces the old second-double-click failure: auto-fit remains true.

Scoped helper lint passed. Full isolated webpack production build with TypeScript/page generation passed. Disabled-scaling configurations are left untouched. No feed/provider restart or account/order/workspace mutation.
