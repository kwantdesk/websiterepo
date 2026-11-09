# Live current-price line delivery — 9 November 2026

## Confirmed cause

The workspace watchlist consumes quote changes immediately. The futures chart deliberately rejects coalesced quote packets as a source of OHLC, because only the execution stream can preserve the true open and extrema. Its native price line was consequently tied to the slower execution-built candle path. This made a healthy quote channel visibly more responsive in the watchlist than on the chart.

A read-only, simultaneous 10-second NQ VPS sample observed 50 quote packets / 43 changed quote prices (inter-change p50 237 ms, p95 491 ms, maximum 501 ms), versus 9 execution batches (inter-batch p50 592 ms, p95 / maximum 2,503 ms). This identifies a concrete delivery-path mismatch, not proof that every reported 10-second stall has the same cause. No raw licensed payload or credentials are retained in this report.

## Repair

- Shared Chart has a separate native price line fed synchronously from validated, noncached live quotes; this path has no React commit, aggregation, history scan or new network subscription.
- Latest real execution also publishes ahead of existing execution accumulation and study painting. Flow-only records never move the price marker; they remain in the lossless accumulator.
- Futures, market-index / equity underlying and cTrader pane consumers publish through the same scoped path. Pane ID, instrument and contract isolate subscriptions; older observations cannot rewind the marker. Actual contract identifiers are preserved through rollover.
- Quotes never rewrite candle OHLC, wicks, saved history, indicator executions or fills. Historical/replay candles continue to use their existing authoritative data. The marker represents the same quote convention as the watchlist, which can be a bid/ask midpoint rather than a last execution.
- Quote labels retain the instrument's display precision without snapping a genuine between-tick midpoint onto a different executed price. The axis retains the contract tick increment. Theme colour and existing line visibility/style are preserved.
- Replay unsubscribes the live marker and restores native historical-price options; returning live restores the quote marker. Cleanup snapshots options because Lightweight Charts mutates its own options object.

## Validation

27/27 focused tests passed: live-price delivery and scope, actual quote/execution consumer branches, mutable-options replay restoration, candle execution authority, execution paint cadence and priority, and closed-history stability.

An isolated headless Chrome harness mounts the actual shared Chart component and actual Lightweight Charts library. It injected 180 test quotes across NQ 1m, ES 5m, GC 1s, SPY 1m, QQQ 200v and NDX 10r. Every exact value reached the correct native series price-line API: p50 0 ms, p95 0.1 ms, maximum 0.3 ms. No candle history writes occurred during quote injection, no browser errors were observed, actual canvas repaint was verified, and replay isolation / return-to-live passed. See browser-timing.json and six-chart-price-lines.png. The screenshot uses deterministic fixture candles; it is not a captured live session.

These timings measure synchronous quote receipt to native chart API, not exchange-to-browser latency, display hardware latency, a full instrument catalogue or a multi-hour live soak. Independent Kwanty/GEX Data chart implementations and the liquidity-map renderer are not modified by this shared Charts/Footprint fix.

Scoped ESLint for the new production helper and typed browser fixtures passed. ESLint over the two existing very large Chart/workspace components exhausted its default 4 GB heap; that broader lint run is not reported as a pass. The isolated full production build checks their TypeScript. The full isolated webpack production build passed, including TypeScript and 87 generated pages. Earlier compile checks caught library-API / nullable-contract typing issues; those were corrected before this successful build. Deployment verification follows the scoped main push. No live gateway, terminal or provider subscription restart; no account/order/workspace mutation; no extra infrastructure or provider spending.
