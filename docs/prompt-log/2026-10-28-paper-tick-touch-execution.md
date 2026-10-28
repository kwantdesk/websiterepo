# Demo SL/TP exact-tick touches — 2026-10-28

Request: fast touches and reversals sometimes fail to close at configured SL/TP; a working level such as29800 must trigger on its received touch and fill at that tick.

Confirmed faults:

- Working protection required a strict prior-price crossing, not just an admitted execution touching/passing the standing level. A breakeven stop whose watermark equals its level, or a level touched while drag protection was suspended, could remain unarmed until price crossed back and crossed again.
- Shared tape fan-out called chart consumers in registration order with no exception boundary. A chart error could discard delivery for later consumers despite acknowledging the worker batch. Cache maintenance and display-quote listeners also ran ahead of protective execution.

Changes: ordinary working SL/TP checks use inclusive admitted execution price tests on the correct side. They still fill at configured tick-snapped protection prices, not the overshoot price. Existing marketable-release bid/ask handling, suspended drag behavior, stale/pre-entry guards, display-only quote exclusion, and actual trade arrival ordering retained.

Shared worker and inline delivery now support executionPriority; the workspace demo engine registers that priority, runs before chart cache/fan-out, and updates its ledger before quote-store display listeners. Isolate every subscriber's callbacks so a broken chart cannot cancel other delivery; log at most once per failed subscription, retain worker acknowledgement and lossless batching. No new provider connection, polling loop, stream cadence change, recording change or gateway restart.

Verification:47 tests pass (execution tape, actual priority delivery, protection placement, cross-device ledger and shared execution-tape tests). New tests reproduce watermark equality/overshoot on long/short SL/TP and breakeven stops. Actual workspace callback is executed through the real shared-worker fan-out with deliberately throwing earlier chart and quote-display listeners: a one-print touch followed by reversal fills exactly, journals/synchronizes before display callbacks, siblings still receive the batch, ack occurs, and duplicate batches cannot add a second exit. Existing tests cover exact quarter ticks, gapped ticks, partial targets and same-millisecond arrival order. Isolated fixture accounts only; no owner order/trade edits or test trades.

Limits: protects processing of received, admitted executions. Browser main-thread scheduling, transport latency, disconnect coverage and previously deferred gateway performance activation are not zero-latency guarantees. Historical seeds remain excluded rather than inventing retroactive fills at levels that may not have existed then. No claim of a full live-session trading soak. Build/lint/release results below.

Full1536MiB-capped BelowNormal production build/TypeScript passed.47targeted tests pass. Scoped lint0errors/19existing warnings with optional React Compiler analysis disabled for this invocation only (ordinary React/Next/hooks/exhaustive-deps retained; config unchanged). Release pending.
