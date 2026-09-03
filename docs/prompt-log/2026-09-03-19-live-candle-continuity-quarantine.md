# Live candle continuity quarantine

## Prompt

> nq live 1m what the f is this, exactly what we cant have happening, diagnose it, fix it and make sure it doesnt happened else where agan too

## Diagnosis

The screenshot shows a live one-minute candle series with missing internal time
buckets and isolated fragments. The shared CME continuity validator already
recognised this class of broken history/live seam and requested an authoritative
history plus execution-archive repair. The failure was in presentation state:
once a chart request had previously settled, starting that repair did not revoke
its settled status or raise a dedicated quarantine. The broken candles therefore
remained visible while reconciliation ran. Separate order-flow hydration could
also lower the generic loading flag before price continuity had recovered.

## Fix

- Added a request-keyed continuity-recovery quarantine to chart hydration.
- A missing live time bucket now covers the chart immediately, clears any stale
  error and starts authoritative tail reconciliation.
- Added a five-second wall-clock watchdog, so a stream that stops completely is
  detected without waiting for the nonexistent next packet to report itself.
- The production minute-rollover check found and corrected an overly eager
  first version of that watchdog. It now observes behind the wall clock by a
  bounded, timeframe-aware grace period, preventing a healthy new bucket from
  being quarantined before its first exchange packet arrives.
- The quarantine cannot be lowered by unrelated order-flow work.
- Only a reconciled candle series that passes the shared CME continuity check
  clears the quarantine.
- The key includes broker, instrument, timeframe, period and replay range, so a
  recovery in one pane cannot cover a different chart.
- The change is in the shared CME time-chart path and therefore protects every
  futures instrument and every time-based interval, not only NQ 1m. Event bars
  remain governed by their execution-count/volume/range boundaries rather than
  invented clock buckets.

## Verification

- Chart hydration/loading-cover tests: 9/9 passed, including the live
  minute-boundary grace regression.
- Chart history-state regression tests: 5/5 passed.
- CME session and continuity tests: 13/13 passed.
- Rithmic candle matrix: 53 instruments x 50 intervals = 2,650 combinations
  passed.
- Focused ESLint: passed.
- TypeScript: passed.
- Production build: passed; all 80 static pages generated.
- Production deployment and live verification: pending.

## Outcome

Pending production deployment.
