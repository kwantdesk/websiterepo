# NQ candles: recover a stalled execution channel

Owner again reports that NQ candles freeze instead of ticking while trading. This receipt covers a reproduced transport-recovery blind spot, not a claim that the owner's complete workspace was visually verified.

## Evidence

A simultaneous 20-second read-only VPS sample received 59 new NQ executions with 36 trade-price changes and 287 quote messages with 95 bid/ask/mark changes. Execution age at the VPS sample was median 12ms, maximum 88ms; quotes median 24ms. The longest execution receipt gap was 3.039s, versus 558ms for quotes. The gateway was connected, its latest event-loop lag was zero, and its overload flag was false. These are one short sample, not a New York capacity or browser-latency guarantee. Genuine bid/ask changes do not themselves constitute candle executions.

The existing execution watchdog refreshed its activity clock for heartbeats. Therefore a socket delivering heartbeats but no initial seed could stay checking indefinitely. A previously seeded socket losing only trade delivery could also continue reporting connected while the independent quote route kept marking P&L. The former seedless/heartbeat condition is reproduced against the previous HEAD engine: its fault-injection test fails before the change and passes afterwards.

The connected browser inventory did not expose the owner's active KwantDesk trading window as a controllable tab. No physical owner-session rendering or performance acceptance is claimed, and the earlier native URL-safety block was not bypassed.

## Change

- Give each execution connection a five-second seed deadline, checked by the existing three-second watchdog. Heartbeats cannot mask an absent seed. A seeded quiet market remains connected.
- Use only a fresh, non-cached, confirmed trade on the same concrete contract from the independent quote channel as evidence. Book movement, unknown clocks, old observations and another contract cannot trigger recovery.
- Allow one second for ordinary worker/render delivery to catch up. If its execution watermark remains behind the known print, re-lease the existing engine. Recoveries are limited to one per 15 seconds and deduplicated by the witnessed watermark; later known missing prints retain a trailing recovery through the cooldown.
- Preserve admitted prints, exact identity deduplication, worker acknowledgement/backpressure and pending lossless batches. Do not create a second engine or provider login. Dispose a pending check when the last subscriber leaves.
- Notify affected panes to use the existing in-place tail-repair path, retaining the visible chart rather than showing a new loading overlay.

No OHLC source, tick increment, interpolation, wick authority, Footprint grouping, chart rendering style, account, order or protection-fill rule changed. The live VPS gateway was not restarted. Healthy feeds add no new HTTP request; only an evidenced recovery negotiates another normal finite execution lease and bounded existing tail repair.

## Validation

52 targeted tests pass, including actual engine, shared subscriber and worker message handlers; missing seed despite heartbeats; genuine quiet seeded periods; normal delivery winning the grace period; stale/cached/book/other-contract rejection; cooldown/disposal; preservation of in-flight and pending batches; existing exact execution candle/wick authority, same-frame painting, CVD seed handoff, lease renewal and protective fills. Full capped production build/TypeScript passes. Scoped lint passes for the changed library/worker modules. The large workspace component was included in TypeScript/build checks rather than another memory-heavy whole-file lint run.

An isolated headless Chrome fixture used the real NQ VPS stream, actual shared subscriber/engine fallback, actual workspace paint scheduler/candle fold, actual Chart imperative candle effect and actual Lightweight Charts renderer. It deliberately dropped three trade packets on the first connection while retaining heartbeats and the independent live quotes. One reconnect recovered delivery: 18 candle updates total, 13 after recovery, two execution connections, zero page errors, and every plotted OHLC value remained on the real quarter-tick grid. Pending prints were not substituted with quote midpoints. This was a small isolated chart, not the owner's complete indicator-heavy workspace. Exploratory absolute source-to-browser age counters were negative because of clock offset and are not used as latency evidence. Screenshot: local `tmp/nq-real-browser-proof.png`.

Reproduction scripts and logs: local `tmp/nq-ticking-source-probe.mjs`, `tmp/nq-real-browser-proof.cjs`, `tmp/nq-freshness-before.cjs`, `tmp/nq-freshness-before.log`, `tmp/nq-freshness-tests.log`, `tmp/nq-freshness-build.log` and `tmp/nq-freshness-lint.log`. Finite signed test URLs stayed in process memory and were not printed; no gateway key was copied into client code.

## Release / remaining acceptance

Scoped production release verification is appended after the main-only Git push. The owner's active-tab freeze and complete-workspace visual cadence remain unverified; do not describe this as guaranteed millisecond painting or proof that every possible stall is eliminated. Existing deferred main gateway performance activation, original Footprint opening transient and other parity/archive dependencies remain separate open work.
