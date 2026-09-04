# Chart periodic performance stalls

## Prompt

The charts become very slow after roughly ten minutes with Footprint, volume profiles and other studies enabled. The slowdown arrives in periods lasting around 30 seconds. Diagnose the cause, fix it, and prevent the recurring stall.

## Diagnosis

`buildFootprintBarsCached` expired every cache on an exact 30-second clock. Expiry synchronously rebuilt the complete visible candle window from the execution tape. A loaded chart can own separate caches for Footprint, its side profile, POC Auction, Bar POC and Market Statistics, so those expensive rebuilds aligned and blocked the browser's main chart thread together.

The volume-profile live fold was also audited. It is already incremental: it accepts only executions newer than its coverage watermark and clones only price rows touched by those executions. It was not the source of the 30-second performance cliff.

## Fix

- Removed the 30-second whole-window Footprint cache expiry.
- Kept the forming bar on the immediate live path.
- Reused unchanged closed bars across live ticks, bar rolls and viewport-window shifts.
- Reconciled late prints and historical corrections through an eight-bar rolling slice once per second.
- Staggered the first reconciliation phase across independent chart caches so the studies do not synchronize again.
- Added a regression covering the former 30-second boundary, late corrections, bounded old-history repair and new-bar rolls.

## Outcome

The chart no longer periodically rebuilds the entire execution history for every order-flow study. Live Footprint remains current, historical corrections still converge, and each maintenance pass has a fixed small upper bound instead of growing with the loaded chart history.

## Verification

- `npm run test:footprint-reconcile-budget`
- `npm run test:footprint-bar-window`
- `npm run test:footprint-profile-rows`
- `npm run test:chart-frame-work`
- `npm run test:chart-interaction-budget`
- Scoped ESLint passed for the changed implementation and regression.
- A 240-bar, 48,000-execution, five-cache benchmark reduced boundary work from 196.9 ms to 5.9 ms (97% lower).
- The full production build compiled successfully, then stopped at the repository's pre-existing duplicate Three.js type installation in `src/app/landing/page.tsx`; no changed file produced a type error.
