# VWAP closed-market flashing — 2026-09-06

## Owner prompt

“vwap glitching on market shut, how the market is ended and then the lines come in and shrink to the middle, keeps flashing, dissapearing etc, it should just stay like that to close off the vwap instead of flashing bs”

## Cause and fix

- Followed the VWAP source and renderer paths. VWAP has no wall-clock animation, but the workspace's candle timestamp normaliser changed observations older than 15 minutes to Date.now(). Repeated old quotes could therefore create current-time/closed-market bars. The earlier countdown fix gated activity only; this task fixes the underlying candle timestamp path.
- Preserve the actual provider observation timestamp across all existing marketTimestamp callers. Unknown/invalid or excessively future observations return NaN, with explicit guards before candle merges and snapshot state changes. Existing tick validation already rejects non-finite timestamps. Do not silently manufacture current-time data from an old quote.
- The common candle merge ignores quote-only snapshots older than 15 minutes, retaining the original candle array. This also prevents old close quotes overwriting the final weighted candle between history refreshes. Timestamped execution processing is not blocked by this quote-only check.
- Period VWAP previously reset to a quote price with zero variance on the first zero-volume bar of a new period; rolling envelopes could evict all weighted observations and do the same. They now emit only weighted points. The completed endpoint and band widths stay put when unweighted tails appear/disappear in data hydration. Rolling windows still count empty bars internally, preserving their declared bar/time window when actual volume resumes.
- No renderer freeze, new animation, polling, provider charges, live-update throttling, session-hours assumptions or historical record deletion. Real new volume and valid historical corrections remain allowed. Draw-on VWAP renderer/settings are unchanged.

## Verification

- 21/21 combined VWAP family, closed-market and countdown tests passed. Cover weighted means/deviation, stable final endpoints across repeated empty-tail hydration, no renderer replacement for identical VWAP family data, window eviction, real reopen/session reset, settings/band/template contracts, and execution of the actual workspace timestamp parser against old/invalid/current observations.
- Existing Rithmic candle-integrity synthetic test suite passed (53 instruments × 50 intervals). This is not a claim of live testing every feed.
- ESLint passed for the changed VWAP library and regression test. Large-component full lint is not claimed because it previously exhausted local heaps.
- Full production build/type checking passed (80 static pages), including the stale-quote merge safeguard. Deployment is checked separately after push. No authenticated visual reproduction/recheck is claimed; these are tested code-level causes matching the reported collapse.
- This prevents new timestamp relabelling and zero-volume VWAP artifacts; it does not audit or rewrite already persisted historical data.

## Existing open launch notes

History backfill/tick-VAP coverage; VXN/options history licensing; off-site restore-tested backups; market-open reliability; final DeepCharts visual parity.
