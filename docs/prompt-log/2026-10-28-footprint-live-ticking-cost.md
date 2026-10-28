# Live footprint and chart responsiveness

Owner reports footprint and ordinary charts feel slow and wants rapid live movement. Traced lossless SSE -> execution tape worker -> pane frame scheduler -> price and footprint paths. Existing worker publishes at 8ms, visible pane scheduler paints next display frame, normal prepared candles already avoid a second display-frame handoff. No timer reduction was made without evidence, and no invented between-tick prices were introduced.

Read-only six-second local VPS SSE sample: 30 NQ executions; source age median 10ms/p95 18ms, delivery-gap median 3ms/p95 793ms/max 1219ms. This is a limited off-hours sample at the gateway, not browser end-to-end latency or a busy New York session guarantee. Gateway sends each admitted execution directly. Previously deferred gateway performance activation still requires the owner's not-trading window; no gateway restart or owner state changes occurred.

Measured a major footprint main-thread cost: numeric localeCompare options inside the same-millisecond execution sort on every footprint rebuild. A 25k-print fixture with 20 prints per millisecond took 112-132ms per warm fold in the initial native-module run. Reuse one Intl.Collator with exactly the former default locale/numeric ordering instead of constructing collation rules for every comparison. Shared UI thread stalls from that fold also delay normal charts and controls.

Repeatable benchmark: `node --experimental-strip-types --import ./scripts/alias-hook.mjs scripts/benchmark-footprint-live-ordering.mjs`. Loads the baseline adapter at ba4081fc and current adapter with the same builder and runtime, seven warm samples each. Observed baseline median 127.67ms/p95 133.42ms, fixed median 18.74ms/p95 31.49ms. Both: 25k volume, zero delta, 60 rows. A synthetic benchmark, not a claimed browser FPS measurement. Other footprint folding/rendering work remains; the fixed 25k case can still exceed a display-frame budget.

60 targeted tests pass: numeric/leading-zero/alphanumeric same-ms order matches former semantics; exact signed execution-path extrema; cached repeated folds/duplicates/input modes; footprint rows and history handoff; actual worker 8ms lossless publication; visible/hidden frame scheduling and prepared candle paints. Scoped default ESLint is clean. Full production build and deployment result recorded below once completed.

No browser owner-pane audit performed. This fixes a measured hot path, not every possible delay or a promise of 1ms screen refresh. Exchanges publish real execution increments and monitors limit visible repaint cadence.

Release checks: production build/TypeScript completed successfully with 1536MiB heap and BelowNormal process priority. Default scoped ESLint exited 0 without warnings.
