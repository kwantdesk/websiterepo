# Footprint cells delayed after fast moves

## Confirmed fault
The live price primitive updates candle geometry independently of cell aggregation. The footprint cache always rebuilds the forming bar, but retains unchanged closed-bar OHLC. New prints affecting a closed bar therefore waited for a one-second, eight-bar rolling correction cursor. With a large loaded window, that cursor can take much longer to revisit the affected bar. The same flaw affected the separate React-owned caches, which could later overwrite a live refresh with stale cell values.

## Repair
Carry the source timestamps of every coalesced live execution batch into the imperative main/profile footprint caches. Rebuild only their affected bar ranges, plus the existing forming/missing ranges. Mark the independent React caches with one dirty marker per affected bar; consume those markers on their next fold. Multiple packets queued before a paint retain all touched buckets. No full-tape rebuild on every tick, changed trade classifications, synthetic volume or changes to historical source policy.

## Verification and limits
22 focused tests pass. A negative control reproduces the stale closed-bar volume with the old no-invalidation path. New checks cover a delayed burst among 500 bars, several irregular event-bar boundaries, independent profile granularity and a later React cache refresh. Unaffected closed-bar objects retain identity and results match full authoritative recomputation. Footprint library ESLint passes. Linting the existing large Chart.tsx exhausted the default approximately 4 GiB Node heap; no larger lint process was started while the platform is in use. Production build/TypeScript checked before committing.

The repair removes an internal post-delivery delay; it does not prove a measured exchange-to-screen latency or resolve any upstream missing execution packets. No gateway, terminal, provider subscription, trading account or owner-tab restart.

Final isolated production webpack build, TypeScript and all 87 pages passed.
