# Remove serial work from chart first load

Owner requested a fix for chart loading rather than another VPS explanation.
Found the real bootstrap awaited Promise.all(cache,execution cache,live seam)
BEFORE issuing the authoritative candle request. Seam includes a12s snapshot
deadline, so fast history could not even start until optional transport finished.
The optional IndexedDB reads also had no first-paint wait limit.

Changes:
- Start cold time-bar OHLC immediately, alongside cache/seam hydration, and reuse
  the settled result in both plain and flow-enriched startup paths. No duplicate
  first OHLC request. Safe early rejection handling preserves real failures.
- Remove live seam from the cache barrier; a late response merges only into the
  same still-active request after authoritative base history was accepted. Live
  tail ownership/continuity and request-scope cancellation remain in force.
- Optional browser-cache reads have a250ms waiting budget; blocked/failed cache
  cannot indefinitely prevent the authoritative network result being consumed.
- If the seam arrives first it participates in the normal base-candle merge.
  Event-bar geometry, exact-flow validation and existing loader safety unchanged.

Verification:21 focused first-load/cache/CVD/hydration/index tests pass. Scoped
ESLint has zero errors and existing workspace warnings. Full optimized build
verification and exact production SHA are checked before handback.

Existing script test-event-bar-first-paint.mjs fails its old cme-event-flow-v4
cache-key string assertion: unchanged HEAD already uses v6 (auction-gap suffix).
No event-history/cache schema was modified for this change.

Limits: no signed-in production40s reproduction or universal near-instant timing
claim. This removes a proven serial dependency; missing histories, weekly
completeness proof and unsupported quick-tunnel SSE remain separate OPEN issues.
