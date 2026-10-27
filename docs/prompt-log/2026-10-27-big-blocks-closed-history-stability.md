# Big Blocks reappearing/disappearing after the candle closed

The owner saw a block change visibility roughly ten candles after it printed.

## Cause reproduced

BigBlocksLiveState froze the positive and negative decisions received through
the direct live candle listener. Historical markers were still taken directly
from each full calculator result, however. A subsequent historical flow change
could omit a previously displayed block, and the next pass could restore it.
Being older than the live edge did not grant those snapshot-origin markers
the same finality as markers originally observed by the live listener.

Three regressions failed before changes: a historical marker ten bars back
disappearing on an empty pass; a qualified historical no-signal decision
acquiring a late marker; and a hydrated historical marker disappearing again.

## Change

The actual snapshot paint effect now passes zones and warm-up into the same
decision authority used by live markers. A closed historical candle with the
required classified inputs seals its positive or negative decision. Once sealed,
routine recalculations cannot delete, invent, move or reverse its originating
block. Projection right edges still follow the existing expiry/crossing rules.

The final snapshot candle stays unsealed, preserving live previews. Bars without
classified flow/warm-up remain unknown and may hydrate once data arrives.
Replay bypasses live historical sealing, preserving causal backward seeks.
Instrument/timeframe/calculation setting changes still create a fresh identity.
This is in-memory chart-session authority, not a new historical signal archive.

Retention remains bounded and now discards chronologically oldest decisions,
so loading older history cannot evict more recent live decisions by insertion
order. No market-feed settings, account data or orders were changed.

## Verification

- 21 Big Blocks tests pass: existing live-preview/rollover/negative-decision,
  frame coalescing, event-coordinate projection, bounded retention and native
  underlay tests, plus the new historical finality regressions.
- An actual calculateDeepEffort result emits a signal ten bars behind the tail.
  Changing its historical flow produces an empty calculator result. The real
  Chart snapshot paint effect is run across 20 alternating versions: one stable
  marker remains, with the original ID and bounds.
- The same effect is exercised in replay, then rewound before the signal:
  no future marker is retained.
- Production Next.js build and scoped ESLint are checked before the scoped
  main-only release. No gateway restart is required.
