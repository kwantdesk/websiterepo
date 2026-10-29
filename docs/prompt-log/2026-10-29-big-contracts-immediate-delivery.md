# Big Contracts: immediate execution delivery

## Request

Owner saw a Big Contracts marker appear roughly six candles after its execution and requested immediate display when a qualifying order trades, like an order-flow platform.

## Findings and repair

- The workspace's imperative execution publisher was gated on Footprint, Instant Tape or Auction Gap. Big Contracts alone never received the events its live listener depended on. Added the enabled `big-trades` study to that gate and the subscription effect dependencies.
- The previous live admission tested individual records while the historical scan clustered records. A cluster crossing the minimum across several incoming batches could qualify only during the periodic full scan. Live and historical paths now share the aggregation rule. Live state retains the pending cluster and reads only the ordered tape suffix since its cursor; distribution measurements remain sampled.
- A cluster now keeps its first execution's ID while its size grows. Its executions, weighted price and last source timestamp remain the same as the historical calculation. No candle volume is substituted for an actual execution.
- Timestamp-only exclusion skipped distinct new executions sharing the sampled watermark's millisecond. A bounded set of identities at the current cursor distinguishes additional executions from duplicates.
- A sampled snapshot can commit behind already received executions. The full-pass calculation catches up from the latest same-scope live tape before returning its replacement markers. It preserves a pending, still-subthreshold cluster through that rebase too. Empty-session bootstrap handles the first qualifying execution before a sampled context exists.
- Execution events now carry the canonical candle array by reference and publish after that batch updates its candle boundaries. Live markers use those boundaries instead of a sampled indicator snapshot. Canonical event-bar projection takes precedence over a stale direct-render coordinate map. The optional Deep Contracts renderer also anchors each execution to its own candle rather than the latest candle in the batch, and merges zones by identity.
- Marker state is accumulated between full passes. A growing cluster that violates the configured reject cap is removed immediately, rather than retaining an ineligible live marker until refresh.

## Validation

- `scripts/test-big-contracts-delivery.mjs` executes the actual workspace publisher, Chart live handlers and sampled calculation callback with controlled executions and primitive spies. Covers Big Contracts alone, no periodic refresh/React dependency for new prints, first-ever print, equal-millisecond executions, duplicate delivery, cross-batch threshold crossing, stable cluster identity, stale-snapshot catch-up, a subthreshold rebase, replay exclusion, clock rollover, six event bars between samples, stale synthetic coordinates, Deep Contracts source-bar anchoring and configured reject caps.
- 120 generated batch prefixes compare incremental event identity, timestamp, price, volume, execution count and side against independently recalculated history. Both uncapped and reject-cap modes pass.
- A proxy over 25,000 retained executions verifies that the incremental update visits fewer than 12 array entries for one new execution, rather than scanning the whole tape every frame.
- Existing Big Trades live-edge, manual-filter (5), anchoring (9), session-split (9), marker-semantics (4), and Deep Contracts/Deep Effort regressions pass. Scoped ESLint and the final production build/TypeScript validation pass.
- `test-backtesting-big-contracts.mjs` passes its numerical execution assertions but fails an obsolete source-text assertion requiring the literal `orderFlow=1&executions=1` in `BacktestingWorkspace.tsx`. That literal is also absent in unchanged HEAD, and that file was not modified. Do not claim this script passes.

## Scope and limits

This repairs browser delivery and marker calculations after actual execution receipt. The particular reported print was not captured with exchange/receipt timestamps, so its exact end-to-end delay is not independently established. The tests use controlled executions, not a claim of measured live provider latency. Genuine archive backfill remains available; no real history is hidden to simulate lower latency. Automatic distribution/filter recalibration retains its existing policy.

No VPS/provider restart, subscription reset, new polling, Vercel tick traffic, trading-state change or invented execution was introduced. The separate crossed-depth-book fault remains open. Deploy once through the existing main-only integration and verify the public commit.
