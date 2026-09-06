# Closed-market indicator flashing — 2026-09-06

## Owner prompt

“some of the indicators are flashing when the market is shut eg big contracts just flashing”

## Findings and fix

- Big Contracts has no intentional blinking animation. The shared Chart sampling effect depended on its own sampled candle output. When the imperative final live candle was ahead of the prop snapshot, each merge allocated another snapshot and re-armed the timer, even with no new executions. This repeatedly rebuilt the indicator windows, sliced execution tape, and marker models.
- Removed that output dependency, retaining committed-snapshot replay comparisons through a ref. Genuine candle/tape changes, historical hydration, indicator enablement and replay still trigger sampling. Direct live-price/execution listeners and update intervals are unchanged; no market-closed gate suppresses genuine updates.
- Big Contracts previously used wall time for its lookback until six hours without executions, then switched to tape time. Unchanged historical prints could expire and later return. Its rolling lookback now consistently ends at the latest execution; it advances when actual executions arrive. This does not manufacture data or turn a stale feed into a live one.

## Verification and limits

- Executed the actual Chart sampling callback and dependency list in a deterministic timer harness. Restoring the old output dependency reproduces the loop; the fixed effect settles once through 100 idle renders, updates on new execution revisions, accepts same-length history corrections/backfills, and handles forward/backward replay.
- Four sampling regression tests and two live Volume/CVD flow tests passed. Six Big Trades data/anchoring checks passed, including unchanged marker equality across the daily close, old six-hour boundary and weekend, then expiration on a genuinely newer execution.
- Big Contracts live-edge suite passed (including immediate admission), session split 9/9 and marker semantics 4/4 passed.
- Two older source-regex checks remain failing: instant-hydration expects the pre-replay conditional and direct setter; archive sharing expects a removed literal key implementation. Inspected HEAD to establish these predate this patch; do not represent this as an entirely green broad test suite.
- TypeScript and full Next.js production build passed (80 static pages). ESLint including the large Chart component exhausted both 4 GB and 8 GB local heaps, so full scoped lint is not verified. Application memory settings are unchanged.
- ESLint passed for the changed Big Trades library and both changed/added test files.
- Browser inventory had no open tabs, so the reported on-screen flashing has not been visually reproduced or rechecked on the user's authenticated chart. The confirmed fixes address the demonstrated idle update feedback and marker-expiry instability, not a claim that every possible renderer flicker is eliminated.
- No provider subscriptions, Vercel stream routing, paid services or polling frequency changes. Scoped main push uses the existing single-project Git deployment path; production success must be checked separately.

## Existing open launch notes

History backfill/tick-VAP coverage; VXN/options history licensing; off-site restore-tested backups; market-open reliability; final DeepCharts visual parity. These remain separate from this fix.
