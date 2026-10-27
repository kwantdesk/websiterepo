# Execution rollover and recovery candle authority — 2026-10-28

Request: historical bodies/wicks still change after candles have printed.

Evidence: two identical fixed-range VPS history reads returned 119 closed NQ one-minute candles with zero OHLC differences. This sample does not prove every archive interval is stable. Initial SSH comparison timed out; retry succeeded. No credentials were printed and no gateway restart occurred.

Found two live client handoff gaps:

- `flushExecutionRecords` published only the newest candle when an execution batch crossed a bar boundary. The renderer's independent observation buffer therefore missed the closing bar's final trades, and could retain an older close even when React later supplied the completed bar.
- Tail recovery merged incoming history/seam over the execution writer directly, bypassing the normal live-authority merge. Also, the live-authority start timestamp depended on separate quote delivery instead of being established by executions themselves.

Changes: publish the closing and successor clock candles in order with each candle's own source-end timestamp; retain the existing event-bar publication path. Binary search selects only the affected tail, avoiding whole-history traversal per tick. Establish the observation start from actual executions, and route recovery through the same live-authority merge used by initial history loading. Missing real historical bars can still backfill; historical extrema can still extend from source data. No artificial candles/wicks, previous-close gap filling, source-feed smoothing, global historical freeze, provider changes or gateway restart.

Validation: regression exercises the actual workspace publication statements with a batch crossing rollover, then repeated stale redraws. Recorded 349-print NQ fixture matches archive OHLC/volume through aggregation AND renderer observations at batch sizes 1, 2, 7, 32, 120 and 349. Additional checks cover several crossed buckets, prefix trimming, execution-only authority and recovery backfill. Existing repaint/execution/background stability checks retained. Build, lint and production release verification recorded below when complete.

Limitation: this is a verified client handoff repair, not a claim that every reported historical anomaly or provider correction has been reproduced. A sustained live-session observation remains necessary to establish that broader result. Gateway performance activation remains deferred per owner instruction to wait until they are no longer trading.

Validation complete:34 node regression tests pass; live-candle-authority script passes19 clock intervals; scoped ESLint0errors/19pre-existing warnings; full production build and TypeScript pass with1536MiB heap/BelowNormal priority. Negative control reproduces execution writer close99 versus old renderer close101; repaired publication retains99 across repeated redraws. Production deployment pending.
