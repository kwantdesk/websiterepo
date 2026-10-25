# Replay selected-range indicator history — 2026-10-25

## Request and confirmed causes

Owner wants the selected history period (for example 5D) to show real candles and enabled indicator history across the same revealed range. Future values remain forbidden.

1. Workspace replay hard-coded the selected session's single-day request even when the toolbar period was 5D.
2. The shared Chart calculation lanes cut most studies to 1,500 bars and order-flow studies to approximately two days. Candles could exist with no study output over their earlier range.
3. Replay disabled the exact historical Footprint reader altogether to prevent whole-bar summary lookahead, leaving older viewport ladders empty when the sampled execution tape was insufficient.
4. Daily/weekly/composite profiles still asked for unbounded whole-session or current-clock snapshots. Their causal paint gate correctly rejected these future profiles, but no bounded developing replacement was requested.

## Repairs

| Surface | Change and boundary |
| --- | --- |
| Candle history | Selected period is anchored to the selected historical session. 5D gets ten calendar days of weekend/holiday headroom, then trims to five real returned CME session labels. It does not invent missing sessions. Current-session request keys share a completed-minute upper boundary. |
| Shared numerical indicators | Replay bypasses live-only 1,500/two-day/20,000-bar calculation tail budgets and consumes the full revealed causal candle prefix. Live tail budgets remain unchanged. This covers shared Chart callers, including Backtesting. Normal calculation warm-up still applies; no fabricated initial values. |
| Overlay chart histories | Replay keeps the full requested historical overlay rather than the last 2,500 candles. Existing live merges retain their cap. |
| Footprint and its shared consumers | Historical reader is active in replay on completed clock bars only, validates exact OHLCV/filter identity, loads the visible historical window, and rejects retained future or different-scope state synchronously. Forming bars still require actual executions. Unknown event-bar closing geometry is not treated as a timed close. Deep Profile Values now activates its required shared Footprint source. |
| Native daily/weekly/composite profiles | Request bounds use the replay completed-minute checkpoint; unopened segments are skipped. Historical profiles never receive the loaded future tape. Replay has no live reconciliation timer. Live session clock checks remain current on every refresh. |
| Route limit | Explicit replay ranges now use the same thirty-calendar-day maximum already supported by ordinary CME history, rather than a four-day limit that rejected five-session pre-roll. The existing 120-day historical lookback validation remains. Longer requested periods are not certified/silently truncated. |

## Verification

- 229 focused replay, exact/compact Footprint, shared history, CVD, TPO and profile tests pass.
- New fixture: five CME sessions, 6,900 minute candles. Actual MA, RSI, ATR, VWAP and CVD calculators produce early-session history, not just a tail. These are deterministic fixtures, not an assertion that all production archive dates are complete.
- Actual compact archive fold/decoder/Footprint calculation reconciles volume and delta. Actual transpiled hook rejects later retained summaries on rewind and wrong viewport/settings scope. Actual daily-profile request-builder expressions clip the developing session and reject unopened segments.
- Scoped helper/hook/route lint passes. Final production build and TypeScript pass, including the completed-minute request-key change (84 pages). Full Chart monolith lint was not rerun after its previously recorded heap exhaustion.
- Six legacy daily-volume-profile-live source-string assertions also fail against unchanged HEAD; these were reproduced read-only and not rewritten or counted as passes. Existing baseline failures are not evidence that every live-profile combination is certified.

## Still open / release

- Twenty current-only studies remain unavailable in replay under the prior 127-entry causality audit. This task does not supply missing historical book/option snapshots or claim all vendor/tool parity.
- Sparse/strongest-print histories cannot impersonate complete exact executions. Missing source history, historical contract rollover coverage, source-publication timing, every-settings acceptance, and recorded archive gaps remain real limitations.
- Exact Footprint is lazy over the historical viewport, not an unbounded download of every tick for five days. Profile checkpoint resolution is one completed minute, not a per-200ms server request.
- No new paid resource, provider login/subscription, polling cadence increase, gateway restart, archive rewrite, production deployment or trading-account mutation.
- Main release remains blocked by the prior safety-review decision pending explicit owner approval. The existing pending staged lookahead work and unrelated dirty files are preserved; ALGO is untouched.
