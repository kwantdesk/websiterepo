# Footprint cold-open and candle-boundary handoff

Owner: footprint initially shows condensed/interim numbers, changes several seconds later, and repeats at new candles.

Confirmed code faults: sampled paint uses exact price-level history while the imperative live path rebuilt the same historical candles from the compacted tape. Nonempty partial bars bypassed row retention and could replace exact rows. Also, sampled source selection assumed every candle before the requested history boundary was already present: advancing the boundary dropped the newly closed bar until its exact response returned.

Changes: shared merge selects exact history per actually covered candle bucket; uncovered/just-closed candles retain their available execution tape. Both base and side-profile builds use this same merge in live and sampled paths. Exact historical rows cannot be overwritten by compacted live history or counted twice. Initial exact request uses the existing themed chart loader, rather than exposing sparse interim rows. A per-contract/timeframe presentation latch prevents later candle-boundary requests from reopening it. Partial/error responses release the initial pending gate; missing executions are not invented. Grouping, colours, filters and drawing/trading state unchanged.

Validation: 62 focused tests pass, including actual cache with 20 forced closed-bar reconciliations/rollover and exact-level preservation, initial pending records, late per-bucket replacement, and execution of the actual cold-open gate through ten subsequent boundary requests. Exact-history hook and new helper ESLint pass; production TypeScript/build checked. Full Chart ESLint remains excluded due established 8 GB heap exhaustion from earlier task. Browser confirmed owner's Tick Grouping Automatic / Grouping Mode Fixed without changing either.

Limit: a cold exact-history request still takes the provider/archive response time; this change prevents showing a misleading intermediate layout, not a promise of zero network delay or recovery of unrecorded sessions.
